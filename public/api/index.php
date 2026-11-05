<?php
declare(strict_types=1);

ob_start();

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    respond(503, ['error' => 'Hostinger API is not configured. Add public/api/config.php using config.example.php.']);
}

$config = require $configPath;
if (!is_array($config)) {
    respond(500, ['error' => 'Hostinger API configuration is invalid.']);
}

$https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
if (!$https && ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') {
    $https = true;
}
session_set_cookie_params([
    'lifetime' => 60 * 60 * 24 * 30,
    'httponly' => true,
    'secure' => $https,
    'samesite' => 'Lax',
    'path' => '/',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if (in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (!$origin || !$host || parse_url($origin, PHP_URL_HOST) !== explode(':', $host)[0]) {
        respond(403, ['error' => 'Request origin is not allowed.']);
    }
}

try {
    $pdo = new PDO(
        sprintf(
            'mysql:host=%s;dbname=%s;charset=utf8mb4',
            $config['db_host'] ?? '',
            $config['db_name'] ?? ''
        ),
        $config['db_user'] ?? '',
        $config['db_password'] ?? '',
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
    ensureSchema($pdo);

    switch ($action) {
        case 'admin-setup':
            requireMethod('POST');
            $input = readJson();
            if (empty($config['admin_setup_key']) || !hash_equals((string) $config['admin_setup_key'], (string) ($input['setupKey'] ?? ''))) {
                respond(403, ['error' => 'Invalid setup key.']);
            }
            if ((int) $pdo->query('SELECT COUNT(*) FROM admin_accounts')->fetchColumn() !== 0) {
                respond(409, ['error' => 'Admin setup has already been completed.']);
            }
            $email = normalizeEmail($input['email'] ?? '');
            $password = $input['password'] ?? '';
            if ($email !== normalizeEmail($config['master_admin_email'] ?? '') || !validPassword($password)) {
                respond(422, ['error' => 'Use the configured master admin email and a password of at least 8 characters.']);
            }
            $statement = $pdo->prepare('INSERT INTO admin_accounts (email, password_hash) VALUES (?, ?)');
            $statement->execute([$email, password_hash($password, PASSWORD_DEFAULT)]);
            session_regenerate_id(true);
            $_SESSION['admin_email'] = $email;
            respond(200, ['email' => $email]);

        case 'admin-login':
            requireMethod('POST');
            $input = readJson();
            $email = normalizeEmail($input['email'] ?? '');
            $statement = $pdo->prepare('SELECT email, password_hash FROM admin_accounts WHERE email = ?');
            $statement->execute([$email]);
            $admin = $statement->fetch();
            if (!$admin || !password_verify((string) ($input['password'] ?? ''), $admin['password_hash'])) {
                respond(401, ['error' => 'Incorrect admin email or password.']);
            }
            session_regenerate_id(true);
            $_SESSION['admin_email'] = $admin['email'];
            respond(200, ['email' => $admin['email']]);

        case 'admin-session':
            requireMethod('GET');
            requireAdmin();
            respond(200, ['email' => $_SESSION['admin_email']]);

        case 'admin-logout':
            requireMethod('POST');
            unset($_SESSION['admin_email']);
            session_regenerate_id(true);
            respond(200, ['ok' => true]);

        case 'admin-change-password':
            requireMethod('POST');
            requireAdmin();
            $input = readJson();
            if (!validPassword($input['newPassword'] ?? null)) {
                respond(422, ['error' => 'Password must be at least 8 characters.']);
            }
            $statement = $pdo->prepare('SELECT password_hash FROM admin_accounts WHERE email = ?');
            $statement->execute([$_SESSION['admin_email']]);
            $hash = $statement->fetchColumn();
            if (!$hash || !password_verify((string) ($input['currentPassword'] ?? ''), $hash)) {
                respond(401, ['error' => 'Current password is incorrect.']);
            }
            if (password_verify((string) $input['newPassword'], $hash)) {
                respond(422, ['error' => 'Choose a password different from your current password.']);
            }
            $statement = $pdo->prepare('UPDATE admin_accounts SET password_hash = ? WHERE email = ?');
            $statement->execute([password_hash($input['newPassword'], PASSWORD_DEFAULT), $_SESSION['admin_email']]);
            respond(200, ['ok' => true]);

        case 'customer-register':
            requireMethod('POST');
            $input = readJson();
            $email = normalizeEmail($input['email'] ?? '');
            $password = $input['password'] ?? '';
            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !validPassword($password, 6)) {
                respond(422, ['error' => 'Enter a valid email and a password of at least 6 characters.']);
            }
            $name = cleanText($input['name'] ?? '', 160);
            $phone = cleanText($input['phone'] ?? '', 40);
            $phoneDigits = preg_replace('/\D+/', '', $phone);
            if ($name === '' || strlen($phoneDigits) < 10 || strlen($phoneDigits) > 15) {
                respond(422, ['error' => 'Name and phone number are required.']);
            }
            $statement = $pdo->prepare('SELECT id FROM customers WHERE email = ? OR phone_digits = ? LIMIT 1');
            $statement->execute([$email, $phoneDigits]);
            if ($statement->fetch()) {
                respond(409, ['error' => 'An account with this email or mobile number already exists. Please log in.']);
            }
            $statement = $pdo->prepare(
                'INSERT INTO customers (email, name, phone, phone_digits, password_hash, provider, providers, addresses, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)'
            );
            $statement->execute([$email, $name, $phone, $phoneDigits, password_hash($password, PASSWORD_DEFAULT), 'email', json_encode(['email']), json_encode([])]);
            $customer = getCustomerByEmail($pdo, $email);
            setCustomerSession($customer);
            respond(201, ['user' => publicCustomer($customer)]);

        case 'customer-login':
            requireMethod('POST');
            $input = readJson();
            $identifier = cleanText($input['identifier'] ?? '', 160);
            $email = normalizeEmail($identifier);
            $phone = preg_replace('/\D+/', '', $identifier);
            $statement = $pdo->prepare('SELECT * FROM customers WHERE email = ? OR phone_digits = ? LIMIT 1');
            $statement->execute([$email, $phone]);
            $customer = $statement->fetch();
            if (!$customer || !$customer['password_hash'] || !password_verify((string) ($input['password'] ?? ''), $customer['password_hash'])) {
                respond(401, ['error' => 'Incorrect email/mobile number or password.']);
            }
            setCustomerSession($customer);
            respond(200, ['user' => publicCustomer($customer)]);

        case 'customer-google':
            requireMethod('POST');
            $input = readJson();
            $token = (string) ($input['accessToken'] ?? '');
            if ($token === '' || empty($config['google_client_id'])) {
                respond(422, ['error' => 'Google sign-in is not configured.']);
            }
            $profile = verifyGoogleToken($token);
            if (
                !$profile ||
                !filter_var($profile['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN) ||
                ($profile['aud'] ?? '') !== $config['google_client_id']
            ) {
                respond(401, ['error' => 'Google could not verify this account. Please try again.']);
            }
            $email = normalizeEmail($profile['email'] ?? '');
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                respond(401, ['error' => 'Google did not return a valid verified email.']);
            }
            $customer = getCustomerByEmail($pdo, $email);
            if (!$customer) {
                $statement = $pdo->prepare(
                    'INSERT INTO customers (email, name, phone, phone_digits, password_hash, provider, providers, addresses, joined_at) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, CURRENT_DATE)'
                );
                $statement->execute([
                    $email,
                    cleanText($profile['name'] ?? '', 160) ?: explode('@', $email)[0],
                    '',
                    '',
                    'google',
                    json_encode(['google']),
                    json_encode([]),
                ]);
                $customer = getCustomerByEmail($pdo, $email);
            } else {
                $providers = json_decode($customer['providers'] ?? '[]', true) ?: [];
                if (!in_array('google', $providers, true)) $providers[] = 'google';
                $statement = $pdo->prepare('UPDATE customers SET providers = ?, provider = ? WHERE email = ?');
                $statement->execute([json_encode($providers), !empty($customer['password_hash']) ? 'email' : 'google', $email]);
                $customer = getCustomerByEmail($pdo, $email);
            }
            setCustomerSession($customer);
            respond(200, ['user' => publicCustomer($customer)]);

        case 'customer-set-password':
            requireMethod('POST');
            requireCustomer();
            $input = readJson();
            if (!validPassword($input['password'] ?? null, 8)) {
                respond(422, ['error' => 'Password must be at least 8 characters.']);
            }
            $statement = $pdo->prepare('SELECT providers FROM customers WHERE email = ?');
            $statement->execute([$_SESSION['customer_email']]);
            $providers = json_decode($statement->fetchColumn() ?: '[]', true) ?: [];
            if (!in_array('email', $providers, true)) $providers[] = 'email';
            $statement = $pdo->prepare('UPDATE customers SET password_hash = ?, provider = ?, providers = ? WHERE email = ?');
            $statement->execute([password_hash($input['password'], PASSWORD_DEFAULT), 'email', json_encode($providers), $_SESSION['customer_email']]);
            respond(200, ['ok' => true]);

        case 'customer-session':
            requireMethod('GET');
            requireCustomer();
            $customer = getCustomerByEmail($pdo, $_SESSION['customer_email']);
            if (!$customer) respond(401, ['error' => 'Customer login is required.']);
            respond(200, ['user' => publicCustomer($customer)]);

        case 'customer-orders':
            requireMethod('GET');
            requireCustomer();
            $shared = getSharedStore($pdo);
            $email = normalizeEmail($_SESSION['customer_email']);
            $orders = $shared ? array_values(array_filter(
                $shared['data']['orders'] ?? [],
                static fn ($order) => normalizeEmail($order['email'] ?? '') === $email
            )) : [];
            respond(200, ['orders' => $orders]);

        case 'product-reviews':
            requireMethod('GET');
            $productId = cleanText($_GET['product_id'] ?? '', 80);
            if ($productId === '') respond(422, ['error' => 'Product ID is required.']);
            $statement = $pdo->prepare(
                'SELECT customer_name AS name, rating, comment, DATE_FORMAT(created_at, \'%Y-%m-%d\') AS date
                 FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC, id DESC'
            );
            $statement->execute([$productId]);
            $reviews = array_map(static function (array $review): array {
                $review['rating'] = (int) $review['rating'];
                $review['verifiedPurchase'] = true;
                return $review;
            }, $statement->fetchAll());
            $yourReview = null;
            $canReview = false;
            if (!empty($_SESSION['customer_email'])) {
                $email = normalizeEmail($_SESSION['customer_email']);
                $statement = $pdo->prepare(
                    'SELECT customer_name AS name, rating, comment, DATE_FORMAT(created_at, \'%Y-%m-%d\') AS date
                     FROM product_reviews WHERE product_id = ? AND customer_email = ?'
                );
                $statement->execute([$productId, $email]);
                $yourReview = $statement->fetch() ?: null;
                $canReview = $yourReview !== null || hasDeliveredProductOrder($pdo, $email, $productId);
            }
            respond(200, [
                'reviews' => $reviews,
                'yourReview' => $yourReview,
                'canReview' => $canReview,
            ]);

        case 'product-review':
            requireMethod('POST');
            requireCustomer();
            $input = readJson();
            $productId = cleanText($input['productId'] ?? '', 80);
            $rating = filter_var($input['rating'] ?? null, FILTER_VALIDATE_INT);
            $comment = cleanText($input['comment'] ?? '', 1000);
            if ($productId === '' || $rating === false || $rating < 1 || $rating > 5 || $comment === '') {
                respond(422, ['error' => 'Enter a rating from 1 to 5 and a review comment.']);
            }
            $email = normalizeEmail($_SESSION['customer_email']);
            if (!hasDeliveredProductOrder($pdo, $email, $productId)) {
                $statement = $pdo->prepare('SELECT 1 FROM product_reviews WHERE product_id = ? AND customer_email = ?');
                $statement->execute([$productId, $email]);
                if (!$statement->fetchColumn()) {
                    respond(403, ['error' => 'Only customers with a delivered order for this product can leave a review.']);
                }
            }
            $statement = $pdo->prepare('SELECT name FROM customers WHERE email = ?');
            $statement->execute([$email]);
            $customerName = trim((string) $statement->fetchColumn());
            $nameParts = preg_split('/\s+/', $customerName) ?: [];
            $displayName = $nameParts[0] ?? 'Verified Customer';
            if (count($nameParts) > 1) $displayName .= ' ' . strtoupper(substr($nameParts[count($nameParts) - 1], 0, 1)) . '.';
            $statement = $pdo->prepare(
                'INSERT INTO product_reviews (product_id, customer_email, customer_name, rating, comment)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE customer_name = VALUES(customer_name), rating = VALUES(rating), comment = VALUES(comment), created_at = CURRENT_TIMESTAMP'
            );
            $statement->execute([$productId, $email, $displayName, $rating, $comment]);
            respond(200, ['ok' => true]);

        case 'customer-profile':
            requireMethod('POST');
            requireCustomer();
            $input = readJson();
            $existingCustomer = getCustomerByEmail($pdo, $_SESSION['customer_email']);
            if (!$existingCustomer) respond(404, ['error' => 'Customer account was not found.']);
            $name = cleanText($input['name'] ?? $existingCustomer['name'], 160);
            $phone = cleanText($input['phone'] ?? $existingCustomer['phone'], 40);
            if ($name === '') respond(422, ['error' => 'Name is required.']);
            if ($phone !== '') {
                $phoneDigits = preg_replace('/\D+/', '', $phone);
                $statement = $pdo->prepare('SELECT id FROM customers WHERE phone_digits = ? AND email <> ? LIMIT 1');
                $statement->execute([$phoneDigits, $_SESSION['customer_email']]);
                if ($statement->fetch()) respond(409, ['error' => 'This mobile number is already linked to another account.']);
            }
            $statement = $pdo->prepare('UPDATE customers SET name = ?, phone = ?, phone_digits = ?, address = ?, city = ?, pin = ?, addresses = ? WHERE email = ?');
            $statement->execute([
                $name,
                $phone,
                preg_replace('/\D+/', '', $phone),
                cleanText($input['address'] ?? $existingCustomer['address'], 500),
                cleanText($input['city'] ?? $existingCustomer['city'], 120),
                cleanText($input['pin'] ?? $existingCustomer['pin'], 20),
                json_encode(is_array($input['addresses'] ?? null)
                    ? $input['addresses']
                    : (json_decode($existingCustomer['addresses'] ?? '[]', true) ?: [])),
                $_SESSION['customer_email'],
            ]);
            respond(200, ['user' => publicCustomer(getCustomerByEmail($pdo, $_SESSION['customer_email']))]);

        case 'customer-logout':
            requireMethod('POST');
            unset($_SESSION['customer_email']);
            session_regenerate_id(true);
            respond(200, ['ok' => true]);

        case 'customers-list':
            requireMethod('GET');
            requireAdmin();
            $customers = $pdo->query(
                'SELECT id, name, email, phone, provider, providers, joined_at
                 FROM customers ORDER BY joined_at DESC, id DESC'
            )->fetchAll();
            $shared = getSharedStore($pdo);
            $orderCounts = [];
            $orders = is_array($shared) ? ($shared['data']['orders'] ?? []) : [];
            foreach ($orders as $order) {
                if (!is_array($order)) continue;
                $email = normalizeEmail($order['email'] ?? '');
                if ($email !== '') $orderCounts[$email] = ($orderCounts[$email] ?? 0) + 1;
            }
            $customers = array_map(static function (array $customer) use ($orderCounts): array {
                $customer['orders'] = $orderCounts[normalizeEmail($customer['email'])] ?? 0;
                return publicCustomer($customer);
            }, $customers);
            respond(200, ['customers' => $customers]);

        case 'customers-count':
            requireMethod('GET');
            requireAdmin();
            $count = (int) $pdo->query('SELECT COUNT(*) FROM customers')->fetchColumn();
            respond(200, ['count' => $count]);

        case 'storefront-data':
            requireMethod('GET');
            $shared = getSharedStore($pdo);
            respond(200, [
                'data' => $shared ? publicStoreData($shared['data']) : null,
                'revision' => $shared ? (int) $shared['revision'] : 0,
            ]);

        case 'admin-data':
            requireAdmin();
            if ($method === 'GET') {
                $shared = getSharedStore($pdo);
                respond(200, [
                    'data' => $shared ? $shared['data'] : null,
                    'revision' => $shared ? (int) $shared['revision'] : 0,
                ]);
            }
            requireMethod('PUT');
            $input = readJson();
            $data = normalizeStoreData($input['data'] ?? null);
            $serialized = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($serialized === false || strlen($serialized) > 4_500_000) {
                respond(413, ['error' => 'The shared store data is too large to save.']);
            }
            $statement = $pdo->prepare(
                'INSERT INTO shared_store (store_key, store_data, revision, updated_at)
                 VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                 ON DUPLICATE KEY UPDATE store_data = VALUES(store_data), revision = revision + 1, updated_at = CURRENT_TIMESTAMP'
            );
            $statement->execute(['main', $serialized]);
            $shared = getSharedStore($pdo);
            respond(200, ['revision' => (int) $shared['revision']]);

        case 'order-create':
            requireMethod('POST');
            $input = readJson();
            $items = $input['items'] ?? null;
            $total = $input['total'] ?? null;
            if (!is_array($items) || count($items) < 1 || count($items) > 100 || !is_numeric($total) || (float) $total < 0) {
                respond(422, ['error' => 'Order details are invalid. Please review your cart and try again.']);
            }
            $email = normalizeEmail($input['email'] ?? '');
            if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                respond(422, ['error' => 'Enter a valid contact email address.']);
            }
            $record = [
                'id' => 'SIE' . date('ymdHis') . strtoupper(bin2hex(random_bytes(3))),
                'customer' => cleanText($input['customer'] ?? '', 160) ?: 'Guest',
                'phone' => cleanText($input['phone'] ?? '', 40),
                'email' => $email,
                'items' => array_map('normalizeOrderItem', $items),
                'total' => round((float) $total, 2),
                'payment' => 'cod',
                'shippingAddress' => normalizeAddress($input['shippingAddress'] ?? []),
                'date' => date('Y-m-d'),
                'status' => 'Pending',
            ];
            appendSharedRecord($pdo, 'orders', $record);
            respond(201, ['order' => $record]);

        case 'admin-order-status':
            requireMethod('POST');
            requireAdmin();
            $input = readJson();
            $orderId = cleanText($input['id'] ?? '', 80);
            $status = cleanText($input['status'] ?? '', 20);
            if ($orderId === '' || !in_array($status, ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'], true)) {
                respond(422, ['error' => 'Order ID or status is invalid.']);
            }
            $updatedOrder = updateSharedOrderStatus($pdo, $orderId, $status);
            if (!$updatedOrder) respond(404, ['error' => 'Order not found.']);
            respond(200, ['order' => $updatedOrder]);

        case 'enquiry-create':
            requireMethod('POST');
            $input = readJson();
            $email = normalizeEmail($input['email'] ?? '');
            if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                respond(422, ['error' => 'Enter a valid email address.']);
            }
            $name = cleanText($input['name'] ?? '', 160);
            $message = cleanText($input['message'] ?? '', 4000);
            if ($name === '' || $message === '') {
                respond(422, ['error' => 'Name and message are required.']);
            }
            $record = [
                'id' => 'ENQ' . date('ymdHis') . strtoupper(bin2hex(random_bytes(3))),
                'name' => $name,
                'email' => $email,
                'phone' => cleanText($input['phone'] ?? '', 40),
                'subject' => cleanText($input['subject'] ?? '', 200),
                'message' => $message,
                'date' => date('Y-m-d'),
                'status' => 'New',
            ];
            appendSharedRecord($pdo, 'enquiries', $record);
            respond(201, ['enquiry' => $record]);

        case 'customers-delete':
            requireMethod('POST');
            requireAdmin();
            $input = readJson();
            $statement = $pdo->prepare('DELETE FROM customers WHERE id = ?');
            $statement->execute([(int) ($input['id'] ?? 0)]);
            respond(200, ['ok' => true]);

        default:
            respond(404, ['error' => 'Unknown API action.']);
    }
} catch (Throwable $error) {
    error_log('Suvarna API error: ' . $error->getMessage());
    respond(500, ['error' => 'The server could not complete this request. Check the Hostinger PHP error log.']);
}

function respond(int $status, array $data)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    if (ob_get_level() > 0) ob_clean();
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    echo $json === false ? '{"error":"The server could not encode its response."}' : $json;
    exit;
}

function ensureSchema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS admin_accounts (
            email VARCHAR(254) PRIMARY KEY,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS customers (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(254) NOT NULL UNIQUE,
            name VARCHAR(160) NOT NULL,
            phone VARCHAR(40) NOT NULL DEFAULT '',
            phone_digits VARCHAR(20) NOT NULL DEFAULT '',
            password_hash VARCHAR(255) NULL,
            provider VARCHAR(20) NOT NULL DEFAULT 'email',
            providers JSON NOT NULL,
            address VARCHAR(500) NOT NULL DEFAULT '',
            city VARCHAR(120) NOT NULL DEFAULT '',
            pin VARCHAR(20) NOT NULL DEFAULT '',
            addresses JSON NOT NULL,
            joined_at DATE NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX customers_phone_digits (phone_digits)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS shared_store (
            store_key VARCHAR(32) NOT NULL PRIMARY KEY,
            store_data LONGTEXT NOT NULL,
            revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS product_reviews (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            product_id VARCHAR(80) NOT NULL,
            customer_email VARCHAR(254) NOT NULL,
            customer_name VARCHAR(80) NOT NULL,
            rating TINYINT UNSIGNED NOT NULL,
            comment VARCHAR(1000) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY product_reviews_customer_product (customer_email, product_id),
            INDEX product_reviews_product_created (product_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function requireMethod(string $expected): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $expected) {
        header('Allow: ' . $expected);
        respond(405, ['error' => 'Method not allowed.']);
    }
}

function readJson(): array
{
    $decoded = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($decoded)) respond(400, ['error' => 'Invalid JSON request body.']);
    return $decoded;
}

function requireAdmin(): void
{
    if (empty($_SESSION['admin_email'])) respond(401, ['error' => 'Admin login is required.']);
}

function requireCustomer(): void
{
    if (empty($_SESSION['customer_email'])) respond(401, ['error' => 'Customer login is required.']);
}

function normalizeEmail(mixed $email): string
{
    if (!is_scalar($email)) return '';
    return strtolower(trim((string) $email));
}

function validPassword(mixed $password, int $minimum = 8): bool
{
    return is_string($password) && strlen($password) >= $minimum && strlen($password) <= 1024;
}

function cleanText(mixed $value, int $maximum): string
{
    if (!is_scalar($value)) return '';
    $text = trim((string) $value);
    return mb_substr($text, 0, $maximum);
}

function getCustomerByEmail(PDO $pdo, string $email): array|false
{
    $statement = $pdo->prepare('SELECT * FROM customers WHERE email = ?');
    $statement->execute([$email]);
    return $statement->fetch();
}

function getSharedStore(PDO $pdo): array|false
{
    $statement = $pdo->prepare('SELECT store_data, revision FROM shared_store WHERE store_key = ?');
    $statement->execute(['main']);
    $row = $statement->fetch();
    if (!$row) return false;
    $data = json_decode($row['store_data'], true);
    if (!is_array($data)) throw new RuntimeException('Shared store data is not valid JSON.');
    return ['data' => $data, 'revision' => $row['revision']];
}

function hasDeliveredProductOrder(PDO $pdo, string $email, string $productId): bool
{
    $shared = getSharedStore($pdo);
    if (!$shared) return false;
    foreach (($shared['data']['orders'] ?? []) as $order) {
        if (!is_array($order) || normalizeEmail($order['email'] ?? '') !== $email) continue;
        if (strtolower((string) ($order['status'] ?? '')) !== 'delivered') continue;
        foreach (($order['items'] ?? []) as $item) {
            if (is_array($item) && (string) ($item['id'] ?? '') === $productId) return true;
        }
    }
    return false;
}

function normalizeStoreData(mixed $data): array
{
    if (!is_array($data)) respond(422, ['error' => 'Shared store data must be an object.']);
    $normalized = [];
    foreach (['products', 'banners', 'promoCards', 'offers', 'videos', 'orders', 'enquiries'] as $key) {
        if (!is_array($data[$key] ?? null)) respond(422, ['error' => 'Invalid shared store collection: ' . $key]);
        $normalized[$key] = array_values($data[$key]);
    }
    foreach (['settings', 'policies'] as $key) {
        if (!is_array($data[$key] ?? null)) respond(422, ['error' => 'Invalid shared store section: ' . $key]);
        $normalized[$key] = $data[$key];
    }
    return $normalized;
}

function appendSharedRecord(PDO $pdo, string $collection, array $record): void
{
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare('SELECT store_data FROM shared_store WHERE store_key = ? FOR UPDATE');
        $statement->execute(['main']);
        $serialized = $statement->fetchColumn();
        if ($serialized === false) {
            $pdo->rollBack();
            respond(503, ['error' => 'Store setup is not complete. Ask the administrator to sign in and initialize the shared store.']);
        }
        $data = json_decode($serialized, true);
        if (!is_array($data) || !is_array($data[$collection] ?? null)) {
            throw new RuntimeException('Shared store is missing the ' . $collection . ' collection.');
        }
        array_unshift($data[$collection], $record);
        $updated = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($updated === false || strlen($updated) > 4_500_000) {
            $pdo->rollBack();
            respond(413, ['error' => 'Store data is too large to add this record.']);
        }
        $statement = $pdo->prepare('UPDATE shared_store SET store_data = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE store_key = ?');
        $statement->execute([$updated, 'main']);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function updateSharedOrderStatus(PDO $pdo, string $orderId, string $status): array|false
{
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare('SELECT store_data FROM shared_store WHERE store_key = ? FOR UPDATE');
        $statement->execute(['main']);
        $serialized = $statement->fetchColumn();
        if ($serialized === false) {
            $pdo->rollBack();
            return false;
        }
        $data = json_decode($serialized, true);
        if (!is_array($data) || !is_array($data['orders'] ?? null)) {
            throw new RuntimeException('Shared store is missing the orders collection.');
        }
        $updatedOrder = false;
        foreach ($data['orders'] as &$order) {
            if ((string) ($order['id'] ?? '') === $orderId) {
                $order['status'] = $status;
                $updatedOrder = $order;
                break;
            }
        }
        unset($order);
        if (!$updatedOrder) {
            $pdo->rollBack();
            return false;
        }
        $updated = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($updated === false || strlen($updated) > 4_500_000) {
            $pdo->rollBack();
            respond(413, ['error' => 'Store data is too large to update this order.']);
        }
        $statement = $pdo->prepare('UPDATE shared_store SET store_data = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE store_key = ?');
        $statement->execute([$updated, 'main']);
        $pdo->commit();
        return $updatedOrder;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function normalizeOrderItem(mixed $item): array
{
    if (!is_array($item)) respond(422, ['error' => 'Order contains an invalid product.']);
    return [
        'id' => cleanText($item['id'] ?? '', 80),
        'name' => cleanText($item['name'] ?? 'Product', 200),
        'qty' => max(1, min(999, (int) ($item['qty'] ?? 1))),
        'price' => max(0, (float) ($item['price'] ?? 0)),
        'brand' => cleanText($item['brand'] ?? '', 100),
        'category' => cleanText($item['category'] ?? '', 100),
        'image' => cleanText($item['image'] ?? '', 500000),
        'oldPrice' => max(0, (float) ($item['oldPrice'] ?? 0)),
        'stock' => max(0, (int) ($item['stock'] ?? 0)),
    ];
}

function normalizeAddress(mixed $address): array
{
    if (!is_array($address)) return [];
    return [
        'address' => cleanText($address['address'] ?? '', 500),
        'city' => cleanText($address['city'] ?? '', 120),
        'pin' => cleanText($address['pin'] ?? '', 20),
    ];
}

function publicStoreData(array $data): array
{
    $public = [];
    foreach (['products', 'banners', 'promoCards', 'offers', 'videos', 'settings', 'policies'] as $key) {
        if (array_key_exists($key, $data)) {
            $public[$key] = $key === 'products'
                ? array_values(array_filter($data[$key], 'isPublishableProduct'))
                : $data[$key];
        }
    }
    return $public;
}

function isPublishableProduct(mixed $product): bool
{
    if (!is_array($product)) return false;
    $name = trim((string) ($product['name'] ?? ''));
    $brand = trim((string) ($product['brand'] ?? ''));
    $description = trim((string) ($product['description'] ?? ''));
    $specs = $product['specs'] ?? null;
    if ($name === '' || $brand === '' || !is_array($specs)) return false;
    if (mb_strlen($description) < 20 || strcasecmp($description, $name) === 0) return false;
    $validSpecs = array_filter($specs, static function ($value): bool {
        if (!is_scalar($value)) return false;
        $value = trim((string) $value);
        return $value !== '' && !preg_match('/^(configuration available|available)$/i', $value);
    });
    if (count($validSpecs) < 2) return false;
    if (strtolower((string) ($product['category'] ?? '')) === 'laptops') {
        $processor = (string) ($specs['processor'] ?? '');
        if (!preg_match('/intel|amd|ryzen|core|ultra|apple|snapdragon|xeon|mediatek|mtk/i', $processor)) return false;
    }
    return true;
}

function publicCustomer(array $customer): array
{
    return [
        'id' => $customer['id'],
        'name' => $customer['name'],
        'email' => $customer['email'],
        'phone' => $customer['phone'] ?: '',
        'provider' => $customer['provider'],
        'providers' => json_decode($customer['providers'] ?? '[]', true) ?: [],
        'address' => $customer['address'] ?? '',
        'city' => $customer['city'] ?? '',
        'pin' => $customer['pin'] ?? '',
        'addresses' => json_decode($customer['addresses'] ?? '[]', true) ?: [],
        'joined' => $customer['joined_at'] ?? '',
        'orders' => isset($customer['orders']) ? (int) $customer['orders'] : null,
    ];
}

function setCustomerSession(array $customer): void
{
    session_regenerate_id(true);
    unset($_SESSION['admin_email']);
    $_SESSION['customer_email'] = $customer['email'];
}

function verifyGoogleToken(string $accessToken): array|false
{
    $url = 'https://oauth2.googleapis.com/tokeninfo?access_token=' . rawurlencode($accessToken);
    $context = stream_context_create(['http' => ['timeout' => 8, 'ignore_errors' => true]]);
    $response = @file_get_contents($url, false, $context);
    if ($response === false) return false;
    $profile = json_decode($response, true);
    return is_array($profile) ? $profile : false;
}
