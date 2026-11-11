<?php
declare(strict_types=1);

ob_start();

const MAX_SHARED_STORE_BYTES = 8_000_000;
const ADMIN_PERMISSION_IDS = [
    'categories', 'products', 'banners', 'promo-cards', 'videos', 'orders',
    'customers', 'enquiries', 'offers', 'settings', 'policies',
];

final class ApiException extends RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}

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
header('X-Suvarna-API-Version: 2026-11-10-customer-login-collation-v2');

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
    // Keep SQL literals and bound string parameters on one collation even when
    // the Hostinger database and existing tables use different defaults.
    $pdo->exec('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
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
            $statement = $pdo->prepare('INSERT INTO admin_accounts (email, password_hash, session_version) VALUES (?, ?, 1)');
            $statement->execute([$email, password_hash($password, PASSWORD_DEFAULT)]);
            $profile = $pdo->prepare('INSERT INTO admin_profiles (email, name, role, permissions, status) VALUES (?, ?, ?, ?, ?)');
            $profile->execute([$email, 'Master Admin', 'Master Admin', json_encode(ADMIN_PERMISSION_IDS), 'Active']);
            session_regenerate_id(true);
            $_SESSION['admin_email'] = $email;
            $_SESSION['admin_session_version'] = 1;
            respond(200, ['email' => $email, 'admin' => getAdminProfile($pdo, $email)]);

        case 'admin-login':
            requireMethod('POST');
            $input = readJson();
            $email = normalizeEmail($input['email'] ?? '');
            $statement = $pdo->prepare('SELECT email, password_hash, session_version FROM admin_accounts WHERE email = ?');
            $statement->execute([$email]);
            $admin = $statement->fetch();
            if (!$admin || !password_verify((string) ($input['password'] ?? ''), $admin['password_hash'])) {
                respond(401, ['error' => 'Incorrect admin email or password.']);
            }
            session_regenerate_id(true);
            $_SESSION['admin_email'] = $admin['email'];
            $_SESSION['admin_session_version'] = (int) $admin['session_version'];
            respond(200, ['email' => $admin['email'], 'admin' => getAdminProfile($pdo, $admin['email'])]);

        case 'admin-session':
            requireMethod('GET');
            requireAdmin();
            respond(200, ['email' => $_SESSION['admin_email'], 'admin' => getAdminProfile($pdo, $_SESSION['admin_email'])]);

        case 'admin-notifications':
            requireMethod('GET');
            requireAdmin();
            $profile = currentAdminProfile();
            verifyAdminNotificationAccount(
                $_GET['expectedEmail'] ?? $_GET['expectedAdminEmail'] ?? null,
                array_key_exists('expectedEmail', $_GET) || array_key_exists('expectedAdminEmail', $_GET)
            );
            $types = [];
            if ($profile['master'] || in_array('orders', $profile['permissions'], true)) $types[] = 'order';
            if ($profile['master'] || in_array('enquiries', $profile['permissions'], true)) $types[] = 'enquiry';
            $notifications = [];
            $unreadCount = 0;
            $afterId = filter_var($_GET['after'] ?? 0, FILTER_VALIDATE_INT);
            $beforeId = filter_var($_GET['before'] ?? 0, FILTER_VALIDATE_INT);
            if ($afterId === false || $afterId < 0 || $beforeId === false || $beforeId < 0 || ($afterId > 0 && $beforeId > 0)) {
                respond(422, ['error' => 'Notification cursor is invalid.']);
            }
            $nextCursor = (int) $afterId;
            $beforeCursor = (int) $beforeId;
            $hasOlder = false;
            $hasMore = false;
            if ($types !== []) {
                $placeholders = implode(', ', array_fill(0, count($types), '?'));
                $cursorCondition = '';
                $cursorParameters = [];
                $orderDirection = 'DESC';
                if ($afterId > 0) {
                    $cursorCondition = ' AND n.id > ?';
                    $cursorParameters[] = $afterId;
                    $orderDirection = 'ASC';
                } elseif ($beforeId > 0) {
                    $cursorCondition = ' AND n.id < ?';
                    $cursorParameters[] = $beforeId;
                }
                $statement = $pdo->prepare(
                    "SELECT n.id, n.type, n.title, n.summary, n.href, n.created_at,
                            (r.notification_id IS NOT NULL) AS is_read
                     FROM admin_notifications n
                     LEFT JOIN admin_notification_reads r
                       ON r.notification_id = n.id AND r.admin_email = ?
                     WHERE n.recipient_email IS NULL AND n.type IN ({$placeholders})
                     {$cursorCondition}
                     ORDER BY n.id {$orderDirection} LIMIT 101"
                );
                $parameters = array_merge([normalizeEmail($_SESSION['admin_email'])], $types);
                $parameters = array_merge($parameters, $cursorParameters);
                $statement->execute($parameters);
                $rows = $statement->fetchAll();
                $hasMore = count($rows) > 100;
                $rows = array_slice($rows, 0, 100);
                $notifications = array_map(static function (array $notification): array {
                    return [
                        'id' => (int) $notification['id'],
                        'type' => $notification['type'],
                        'title' => $notification['title'],
                        'summary' => $notification['summary'],
                        'href' => $notification['href'],
                        'createdAt' => $notification['created_at'],
                        'read' => (bool) $notification['is_read'],
                    ];
                }, $rows);
                if ($notifications !== []) {
                    $nextCursor = max($nextCursor, max(array_column($notifications, 'id')));
                    $beforeCursor = min(array_column($notifications, 'id'));
                    $older = $pdo->prepare(
                        "SELECT 1 FROM admin_notifications
                         WHERE recipient_email IS NULL AND type IN ({$placeholders}) AND id < ? LIMIT 1"
                    );
                    $older->execute(array_merge($types, [$beforeCursor]));
                    $hasOlder = (bool) $older->fetchColumn();
                } elseif ($beforeId > 0) {
                    $older = $pdo->prepare(
                        "SELECT 1 FROM admin_notifications
                         WHERE recipient_email IS NULL AND type IN ({$placeholders}) AND id < ? LIMIT 1"
                    );
                    $older->execute(array_merge($types, [$beforeId]));
                    $hasOlder = (bool) $older->fetchColumn();
                }
                $count = $pdo->prepare(
                    "SELECT COUNT(*) FROM admin_notifications n
                     LEFT JOIN admin_notification_reads r
                       ON r.notification_id = n.id AND r.admin_email = ?
                    WHERE n.recipient_email IS NULL AND n.type IN ({$placeholders}) AND r.notification_id IS NULL"
                );
                $count->execute(array_merge([normalizeEmail($_SESSION['admin_email'])], $types));
                $unreadCount = (int) $count->fetchColumn();
            }
            respond(200, [
                'notifications' => $notifications,
                'unreadCount' => $unreadCount,
                'nextCursor' => $nextCursor,
                'beforeCursor' => $beforeCursor,
                'hasOlder' => $hasOlder,
                'hasMore' => $hasMore,
            ]);

        case 'admin-notifications-read':
            requireMethod('POST');
            requireAdmin();
            $profile = currentAdminProfile();
            $types = [];
            if ($profile['master'] || in_array('orders', $profile['permissions'], true)) $types[] = 'order';
            if ($profile['master'] || in_array('enquiries', $profile['permissions'], true)) $types[] = 'enquiry';
            $input = readJson();
            verifyAdminNotificationAccount(
                $input['expectedEmail'] ?? $input['expectedAdminEmail'] ?? null,
                array_key_exists('expectedEmail', $input) || array_key_exists('expectedAdminEmail', $input)
            );
            $ids = $input['ids'] ?? [];
            $markAll = ($input['all'] ?? false) === true;
            if (!is_array($ids) || count($ids) > 100 || (!$markAll && $ids === [])) {
                respond(422, ['error' => 'Select notifications to mark as read.']);
            }
            foreach ($ids as $id) {
                if (!(is_int($id) || (is_string($id) && ctype_digit($id))) || (int) $id < 1) {
                    respond(422, ['error' => 'Notification IDs are invalid.']);
                }
            }
            $ids = array_values(array_unique(array_map('intval', $ids)));
            if ($types === []) respond(200, ['marked' => 0]);

            $typePlaceholders = implode(', ', array_fill(0, count($types), '?'));
            $sql = 'INSERT IGNORE INTO admin_notification_reads (notification_id, admin_email, read_at)
                    SELECT n.id, ?, CURRENT_TIMESTAMP FROM admin_notifications n
                    WHERE n.recipient_email IS NULL AND n.type IN (' . $typePlaceholders . ')';
            $parameters = [normalizeEmail($_SESSION['admin_email']), ...$types];
            if (!$markAll) {
                $idPlaceholders = implode(', ', array_fill(0, count($ids), '?'));
                $sql .= ' AND n.id IN (' . $idPlaceholders . ')';
                $parameters = array_merge($parameters, array_map('intval', $ids));
            }
            $statement = $pdo->prepare($sql);
            $statement->execute($parameters);
            respond(200, ['marked' => $statement->rowCount()]);

        case 'customer-notifications':
            requireMethod('GET');
            $customerEmail = verifyCustomerAccount(
                $_GET['expectedEmail'] ?? null,
                array_key_exists('expectedEmail', $_GET)
            );
            $afterId = filter_var($_GET['after'] ?? 0, FILTER_VALIDATE_INT);
            $beforeId = filter_var($_GET['before'] ?? 0, FILTER_VALIDATE_INT);
            if ($afterId === false || $afterId < 0 || $beforeId === false || $beforeId < 0 || ($afterId > 0 && $beforeId > 0)) {
                respond(422, ['error' => 'Notification cursor is invalid.']);
            }
            $cursorCondition = '';
            $cursorParameters = [];
            $orderDirection = 'DESC';
            if ($afterId > 0) {
                $cursorCondition = ' AND n.id > ?';
                $cursorParameters[] = $afterId;
                $orderDirection = 'ASC';
            } elseif ($beforeId > 0) {
                $cursorCondition = ' AND n.id < ?';
                $cursorParameters[] = $beforeId;
            }
            $statement = $pdo->prepare(
                "SELECT n.id, n.type, n.title, n.summary, n.href, n.created_at,
                        (r.notification_id IS NOT NULL) AS is_read
                 FROM admin_notifications n
                 LEFT JOIN customer_notification_reads r
                   ON r.notification_id = n.id AND r.customer_email = ?
                 WHERE n.recipient_email = ?{$cursorCondition}
                 ORDER BY n.id {$orderDirection} LIMIT 101"
            );
            $parameters = [$customerEmail, $customerEmail, ...$cursorParameters];
            $statement->execute($parameters);
            $rows = $statement->fetchAll();
            $hasMore = count($rows) > 100;
            $rows = array_slice($rows, 0, 100);
            $notifications = array_map(static function (array $notification): array {
                return [
                    'id' => (int) $notification['id'],
                    'type' => $notification['type'],
                    'title' => $notification['title'],
                    'summary' => $notification['summary'],
                    'href' => $notification['href'],
                    'createdAt' => $notification['created_at'],
                    'read' => (bool) $notification['is_read'],
                ];
            }, $rows);
            $nextCursor = (int) $afterId;
            if ($notifications !== []) $nextCursor = max($nextCursor, max(array_column($notifications, 'id')));
            $beforeCursor = $beforeId;
            $hasOlder = false;
            if ($notifications !== []) {
                $beforeCursor = min(array_column($notifications, 'id'));
                $older = $pdo->prepare('SELECT 1 FROM admin_notifications WHERE recipient_email = ? AND id < ? LIMIT 1');
                $older->execute([$customerEmail, $beforeCursor]);
                $hasOlder = (bool) $older->fetchColumn();
            } elseif ($beforeId > 0) {
                $older = $pdo->prepare('SELECT 1 FROM admin_notifications WHERE recipient_email = ? AND id < ? LIMIT 1');
                $older->execute([$customerEmail, $beforeId]);
                $hasOlder = (bool) $older->fetchColumn();
            }
            $count = $pdo->prepare(
                'SELECT COUNT(*) FROM admin_notifications n
                 LEFT JOIN customer_notification_reads r
                   ON r.notification_id = n.id AND r.customer_email = ?
                 WHERE n.recipient_email = ? AND r.notification_id IS NULL'
            );
            $count->execute([$customerEmail, $customerEmail]);
            respond(200, [
                'notifications' => $notifications,
                'unreadCount' => (int) $count->fetchColumn(),
                'nextCursor' => $nextCursor,
                'beforeCursor' => $beforeCursor,
                'hasOlder' => $hasOlder,
                'hasMore' => $hasMore,
            ]);

        case 'customer-notifications-read':
            requireMethod('POST');
            $input = readJson();
            $customerEmail = verifyCustomerAccount(
                $input['expectedEmail'] ?? null,
                array_key_exists('expectedEmail', $input)
            );
            $ids = $input['ids'] ?? [];
            $markAll = ($input['all'] ?? false) === true;
            if (!is_array($ids) || count($ids) > 100 || (!$markAll && $ids === [])) {
                respond(422, ['error' => 'Select notifications to mark as read.']);
            }
            foreach ($ids as $id) {
                if (!(is_int($id) || (is_string($id) && ctype_digit($id))) || (int) $id < 1) {
                    respond(422, ['error' => 'Notification IDs are invalid.']);
                }
            }
            $ids = array_values(array_unique(array_map('intval', $ids)));
            $sql = 'INSERT IGNORE INTO customer_notification_reads (notification_id, customer_email, read_at)
                    SELECT n.id, ?, CURRENT_TIMESTAMP FROM admin_notifications n
                    WHERE n.recipient_email = ?';
            $parameters = [$customerEmail, $customerEmail];
            if (!$markAll) {
                $idPlaceholders = implode(', ', array_fill(0, count($ids), '?'));
                $sql .= ' AND n.id IN (' . $idPlaceholders . ')';
                $parameters = array_merge($parameters, $ids);
            }
            $statement = $pdo->prepare($sql);
            $statement->execute($parameters);
            respond(200, ['marked' => $statement->rowCount()]);

        case 'admin-logout':
            requireMethod('POST');
            unset($_SESSION['admin_email']);
            unset($_SESSION['admin_session_version']);
            session_regenerate_id(true);
            respond(200, ['ok' => true]);

        case 'admin-change-password':
            requireMethod('POST');
            requireAdmin();
            $input = readJson();
            if (!validPassword($input['newPassword'] ?? null)) {
                respond(422, ['error' => 'Password must be at least 8 characters.']);
            }
            $pdo->beginTransaction();
            try {
                $statement = $pdo->prepare('SELECT password_hash, session_version FROM admin_accounts WHERE email = ? FOR UPDATE');
                $statement->execute([$_SESSION['admin_email']]);
                $account = $statement->fetch();
                if (!$account || !password_verify((string) ($input['currentPassword'] ?? ''), $account['password_hash'])) {
                    $pdo->rollBack();
                    respond(401, ['error' => 'Current password is incorrect.']);
                }
                if (password_verify((string) $input['newPassword'], $account['password_hash'])) {
                    $pdo->rollBack();
                    respond(422, ['error' => 'Choose a password different from your current password.']);
                }
                $statement = $pdo->prepare('UPDATE admin_accounts SET password_hash = ?, session_version = session_version + 1 WHERE email = ?');
                $statement->execute([password_hash($input['newPassword'], PASSWORD_DEFAULT), $_SESSION['admin_email']]);
                $version = $pdo->prepare('SELECT session_version FROM admin_accounts WHERE email = ?');
                $version->execute([$_SESSION['admin_email']]);
                $nextSessionVersion = (int) $version->fetchColumn();
                $pdo->commit();
                $_SESSION['admin_session_version'] = $nextSessionVersion;
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
            respond(200, ['ok' => true]);

        case 'admin-invites':
            requireMethod('GET');
            requireMasterAdmin();
            $statement = $pdo->query(
                'SELECT email, name, role, permissions, status, DATE_FORMAT(created_at, \'%Y-%m-%d\') AS addedAt
                 FROM admin_profiles ORDER BY created_at ASC'
            );
            $admins = array_map('normalizeAdminProfile', $statement->fetchAll());
            respond(200, ['admins' => $admins]);

        case 'admin-invite':
            requireMethod('POST');
            requireMasterAdmin();
            $input = readJson();
            $email = normalizeEmail($input['email'] ?? '');
            $name = cleanText($input['name'] ?? '', 160) ?: (explode('@', $email)[0] ?? '');
            $role = cleanText($input['role'] ?? 'Editor', 40);
            $permissions = normalizeAdminPermissions($input['permissions'] ?? ['products', 'offers']);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !in_array($role, ['Editor', 'Manager', 'Support'], true)) {
                respond(422, ['error' => 'Enter a valid admin email and role.']);
            }
            $exists = $pdo->prepare('SELECT 1 FROM admin_profiles WHERE email = ?');
            $exists->execute([$email]);
            if ($exists->fetchColumn()) respond(409, ['error' => 'This email already has admin access.']);
            $inviteCode = 'SIE-' . strtoupper(bin2hex(random_bytes(4)));
            $statement = $pdo->prepare(
                'INSERT INTO admin_profiles (email, name, role, permissions, invite_hash, status)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $statement->execute([$email, $name, $role, json_encode($permissions), hash('sha256', $inviteCode), 'Invited']);
            respond(201, ['admin' => getAdminProfile($pdo, $email), 'inviteCode' => $inviteCode]);

        case 'admin-invitation-complete':
            requireMethod('POST');
            $input = readJson();
            $email = normalizeEmail($input['email'] ?? '');
            $inviteCode = strtoupper(cleanText($input['inviteCode'] ?? '', 80));
            $password = $input['password'] ?? null;
            $name = cleanText($input['name'] ?? '', 160);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !validPassword($password)) {
                respond(422, ['error' => 'Enter a valid email address and a password of at least 8 characters.']);
            }
            $statement = $pdo->prepare('SELECT invite_hash, status FROM admin_profiles WHERE email = ?');
            $statement->execute([$email]);
            $invitation = $statement->fetch();
            if (
                !$invitation ||
                $invitation['status'] !== 'Invited' ||
                !hash_equals((string) $invitation['invite_hash'], hash('sha256', $inviteCode))
            ) {
                respond(422, ['error' => 'Invalid invitation email or code.']);
            }
            $pdo->beginTransaction();
            try {
                $account = $pdo->prepare('INSERT INTO admin_accounts (email, password_hash) VALUES (?, ?)');
                $account->execute([$email, password_hash($password, PASSWORD_DEFAULT)]);
                $profile = $pdo->prepare(
                    'UPDATE admin_profiles SET name = ?, invite_hash = NULL, status = ? WHERE email = ? AND status = ?'
                );
                $profile->execute([$name ?: explode('@', $email)[0], 'Active', $email, 'Invited']);
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
            respond(200, ['ok' => true]);

        case 'admin-update':
            requireMethod('POST');
            requireMasterAdmin();
            $input = readJson();
            $email = normalizeEmail($input['email'] ?? '');
            if ($email === normalizeEmail($config['master_admin_email'] ?? '')) {
                respond(422, ['error' => 'The master admin profile cannot be changed here.']);
            }
            $role = cleanText($input['role'] ?? '', 40);
            if (!in_array($role, ['Editor', 'Manager', 'Support'], true)) {
                respond(422, ['error' => 'The admin role is invalid.']);
            }
            $permissions = normalizeAdminPermissions($input['permissions'] ?? []);
            $statement = $pdo->prepare('UPDATE admin_profiles SET role = ?, permissions = ? WHERE email = ?');
            $statement->execute([$role, json_encode($permissions), $email]);
            if ($statement->rowCount() === 0) {
                $exists = $pdo->prepare('SELECT 1 FROM admin_profiles WHERE email = ?');
                $exists->execute([$email]);
                if (!$exists->fetchColumn()) respond(404, ['error' => 'Admin profile was not found.']);
            }
            respond(200, ['admin' => getAdminProfile($pdo, $email)]);

        case 'admin-remove':
            requireMethod('POST');
            requireMasterAdmin();
            $input = readJson();
            $email = normalizeEmail($input['email'] ?? '');
            if ($email === normalizeEmail($config['master_admin_email'] ?? '')) {
                respond(422, ['error' => 'The master admin cannot be removed.']);
            }
            $pdo->beginTransaction();
            try {
                $pdo->prepare('DELETE FROM admin_accounts WHERE email = ?')->execute([$email]);
                $pdo->prepare('DELETE FROM admin_notification_reads WHERE admin_email = ?')->execute([$email]);
                $pdo->prepare('DELETE FROM admin_profiles WHERE email = ?')->execute([$email]);
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
            respond(200, ['ok' => true]);

        case 'media-upload':
            requireMethod('POST');
            requireAdminAny(['products', 'banners', 'promo-cards', 'videos', 'offers']);
            $upload = $_FILES['media'] ?? null;
            if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                respond(422, ['error' => 'Select a valid image or video file and try again.']);
            }
            if (($upload['size'] ?? 0) < 1 || $upload['size'] > 4 * 1024 * 1024) {
                respond(413, ['error' => 'Media files must be no larger than 4 MB.']);
            }
            $mime = (new finfo(FILEINFO_MIME_TYPE))->file($upload['tmp_name']);
            $url = storeMediaFile($mime, file_get_contents($upload['tmp_name']));
            respond(201, ['url' => $url, 'mimeType' => $mime]);

        case 'admin-media-migrate':
            requireMethod('POST');
            requireMasterAdmin();
            $pdo->beginTransaction();
            try {
                $statement = $pdo->prepare('SELECT store_data, revision FROM shared_store WHERE store_key = ? FOR UPDATE');
                $statement->execute(['main']);
                $shared = $statement->fetch();
                if (!$shared) {
                    $pdo->commit();
                    respond(200, ['migrated' => 0, 'revision' => 0]);
                }
                $data = json_decode($shared['store_data'], true);
                if (!is_array($data)) throw new RuntimeException('Shared store data is not valid JSON.');
                $migration = externalizeEmbeddedMedia($data);
                if ($migration['migrated'] > 0) {
                    $serialized = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                    if ($serialized === false || strlen($serialized) > MAX_SHARED_STORE_BYTES) {
                        throw new RuntimeException('Migrated shared store data exceeds the configured size limit.');
                    }
                    $update = $pdo->prepare('UPDATE shared_store SET store_data = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE store_key = ?');
                    $update->execute([$serialized, 'main']);
                }
                $pdo->commit();
                respond(200, [
                    'migrated' => $migration['migrated'],
                    'skipped' => $migration['skipped'],
                    'revision' => (int) $shared['revision'] + ($migration['migrated'] > 0 ? 1 : 0),
                ]);
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }

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
            if ($name === '' || !preg_match('/^[+0-9 ().-]+$/D', $phone) || strlen($phoneDigits) < 10 || strlen($phoneDigits) > 15) {
                respond(422, ['error' => 'Name and phone number are required.']);
            }
            $phone = $phoneDigits;
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
            if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $statement = $pdo->prepare('SELECT * FROM customers WHERE email = ? LIMIT 1');
                $statement->execute([$email]);
            } elseif ($phone !== '') {
                $statement = $pdo->prepare('SELECT * FROM customers WHERE phone_digits = ? LIMIT 1');
                $statement->execute([$phone]);
            } else {
                respond(401, ['error' => 'Incorrect email/mobile number or password.']);
            }
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
            if (($input['purpose'] ?? '') === 'password-recovery') {
                if (!$customer) respond(404, ['error' => 'No customer account exists for the verified Google email.']);
                $recoveryToken = mintCustomerPasswordRecoveryToken($pdo, $email);
                respond(200, [
                    'recoveryToken' => $recoveryToken,
                    'email' => $email,
                    'expiresIn' => 600,
                ]);
            }
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

        case 'customer-password-recovery-validate':
            requireMethod('POST');
            $input = readJson();
            $recoveryToken = cleanText($input['recoveryToken'] ?? '', 128);
            if (!preg_match('/^[a-f0-9]{64}$/D', $recoveryToken) || !isValidCustomerPasswordRecoveryToken($pdo, $recoveryToken)) {
                respond(401, ['error' => 'Password recovery request is invalid or has expired. Request a new reset link.']);
            }
            respond(200, ['valid' => true]);

        case 'customer-set-password':
            requireMethod('POST');
            $input = readJson();
            if (!validPassword($input['password'] ?? null, 8)) {
                respond(422, ['error' => 'Password must be at least 8 characters.']);
            }
            $recoveryToken = cleanText($input['recoveryToken'] ?? '', 128);
            $recoveryFlow = array_key_exists('recoveryToken', $input) || ($input['flow'] ?? '') === 'recovery';
            if ($recoveryFlow) {
                if (!preg_match('/^[a-f0-9]{64}$/D', $recoveryToken)) {
                    respond(401, ['error' => 'Password recovery request is invalid or has expired. Verify your account again.']);
                }
                consumeCustomerPasswordRecoveryToken($pdo, $recoveryToken, $input['password']);
                respond(200, ['ok' => true]);
            }
            $email = verifyCustomerAccount(
                $input['expectedEmail'] ?? null,
                array_key_exists('expectedEmail', $input)
            );
            $statement = $pdo->prepare('SELECT providers FROM customers WHERE email = ?');
            $statement->execute([$email]);
            $providers = json_decode($statement->fetchColumn() ?: '[]', true) ?: [];
            if (!in_array('email', $providers, true)) $providers[] = 'email';
            $statement = $pdo->prepare('UPDATE customers SET password_hash = ?, provider = ?, providers = ? WHERE email = ?');
            $statement->execute([password_hash($input['password'], PASSWORD_DEFAULT), 'email', json_encode($providers), $email]);
            respond(200, ['ok' => true]);

        case 'customer-password-recovery-request':
            requireMethod('POST');
            $input = readJson();
            $email = normalizeEmail($input['email'] ?? '');
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                respond(422, ['error' => 'Enter a valid account email address.']);
            }
            $statement = $pdo->prepare('SELECT email FROM customers WHERE email = ? LIMIT 1');
            $statement->execute([$email]);
            if ($statement->fetchColumn()) {
                $recent = $pdo->prepare('SELECT 1 FROM customer_password_recovery_tokens WHERE email = ? AND created_at > DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 MINUTE) LIMIT 1');
                $recent->execute([$email]);
                if (!$recent->fetchColumn()) {
                    $token = mintCustomerPasswordRecoveryToken($pdo, $email);
                    $resetUrl = 'https://suvarnaitenterprises.com/forgot-password?token=' . rawurlencode($token);
                    $domainSender = 'noreply@suvarnaitenterprises.com';
                    $fromEmail = normalizeEmail($config['recovery_from_email'] ?? $domainSender);
                    if (!filter_var($fromEmail, FILTER_VALIDATE_EMAIL) || !str_ends_with($fromEmail, '@suvarnaitenterprises.com')) {
                        error_log('Password reset sender must be an address on suvarnaitenterprises.com; using the domain fallback.');
                        $fromEmail = $domainSender;
                    }
                    $headers = implode("\r\n", [
                        "From: Suvarna IT Enterprises <{$fromEmail}>",
                        "Reply-To: {$fromEmail}",
                        'MIME-Version: 1.0',
                        'Content-Type: text/plain; charset=UTF-8',
                    ]);
                    $sent = mail(
                        $email,
                        'Reset your Suvarna IT Enterprises password',
                        "We received a request to reset your account password. Use this one-time link within 10 minutes:\n\n{$resetUrl}\n\nIf you did not request this, you can ignore this email.",
                        $headers,
                        '-f' . $fromEmail
                    );
                    if (!$sent) error_log('Customer password recovery mail() returned false; Hostinger did not accept the reset email for delivery.');
                    else error_log('Customer password recovery message was accepted by the local mail transport; recipient delivery is not confirmed.');
                }
            }
            respond(200, ['ok' => true]);

        case 'customer-session':
            requireMethod('GET');
            requireCustomer();
            $customer = getCustomerByEmail($pdo, $_SESSION['customer_email']);
            if (!$customer) respond(401, ['error' => 'Customer login is required.']);
            respond(200, ['user' => publicCustomer($customer)]);

        case 'customer-orders':
            requireMethod('GET');
            $email = verifyCustomerAccount(
                $_GET['expectedEmail'] ?? null,
                array_key_exists('expectedEmail', $_GET)
            );
            $shared = getSharedStore($pdo);
            $orders = $shared ? array_values(array_filter(
                $shared['data']['orders'] ?? [],
                static fn ($order) => normalizeEmail($order['email'] ?? '') === $email
            )) : [];
            respond(200, ['orders' => array_map('customerOrderView', $orders)]);

        case 'product-reviews':
            requireMethod('GET');
            $productId = cleanText($_GET['product_id'] ?? '', 80);
            if ($productId === '') respond(422, ['error' => 'Product ID is required.']);
            $shared = getSharedStore($pdo);
            $statement = $pdo->prepare(
                'SELECT customer_email, customer_name AS name, rating, comment, DATE_FORMAT(created_at, \'%Y-%m-%d\') AS date
                 FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC, id DESC'
            );
            $statement->execute([$productId]);
            $eligibleReviews = array_filter(
                $statement->fetchAll(),
                static fn (array $review): bool => hasDeliveredProductOrder($pdo, normalizeEmail($review['customer_email']), $productId, $shared)
            );
            $reviews = array_map(static function (array $review): array {
                unset($review['customer_email']);
                $review['rating'] = (int) $review['rating'];
                $review['verifiedPurchase'] = true;
                return $review;
            }, array_values($eligibleReviews));
            $yourReview = null;
            $canReview = false;
            if (!empty($_SESSION['customer_email'])) {
                $email = normalizeEmail($_SESSION['customer_email']);
                $eligiblePurchase = hasDeliveredProductOrder($pdo, $email, $productId, $shared);
                $statement = $pdo->prepare(
                    'SELECT customer_name AS name, rating, comment, DATE_FORMAT(created_at, \'%Y-%m-%d\') AS date
                     FROM product_reviews WHERE product_id = ? AND customer_email = ?'
                );
                $statement->execute([$productId, $email]);
                $yourReview = $eligiblePurchase ? ($statement->fetch() ?: null) : null;
                $canReview = $eligiblePurchase;
            }
            respond(200, [
                'reviews' => $reviews,
                'yourReview' => $yourReview,
                'canReview' => $canReview,
            ]);

        case 'product-reviews-export':
            requireMethod('GET');
            requireAdmin('products');
            $shared = getSharedStore($pdo);
            $statement = $pdo->query(
                'SELECT product_id AS productId, customer_email, customer_name AS name, rating, comment,
                        DATE_FORMAT(created_at, \'%Y-%m-%d\') AS date
                 FROM product_reviews ORDER BY product_id ASC, created_at DESC, id DESC'
            );
            $eligibleReviews = array_filter(
                $statement->fetchAll(),
                static fn (array $review): bool => hasDeliveredProductOrder($pdo, normalizeEmail($review['customer_email']), (string) $review['productId'], $shared)
            );
            $reviews = array_map(static function (array $review): array {
                unset($review['customer_email']);
                $review['rating'] = (int) $review['rating'];
                $review['verifiedPurchase'] = true;
                return $review;
            }, array_values($eligibleReviews));
            respond(200, ['reviews' => $reviews]);

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
                respond(403, ['error' => 'Only customers with a delivered order for this product can leave a review.']);
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
            $input = readJson();
            $email = verifyCustomerAccount(
                $input['expectedEmail'] ?? null,
                array_key_exists('expectedEmail', $input)
            );
            $existingCustomer = getCustomerByEmail($pdo, $email);
            if (!$existingCustomer) respond(404, ['error' => 'Customer account was not found.']);
            $name = cleanText($input['name'] ?? $existingCustomer['name'], 160);
            $phone = cleanText($input['phone'] ?? $existingCustomer['phone'], 40);
            if ($name === '') respond(422, ['error' => 'Name is required.']);
            $phoneDigits = preg_replace('/\D+/', '', $phone);
            if ($phone !== '' && (!preg_match('/^[+0-9 ().-]+$/D', $phone) || strlen($phoneDigits) < 10 || strlen($phoneDigits) > 15)) {
                respond(422, ['error' => 'Enter a valid phone number with 10 to 15 digits.']);
            }
            if ($phone !== '') {
                $statement = $pdo->prepare('SELECT id FROM customers WHERE phone_digits = ? AND id <> ? LIMIT 1');
                $statement->execute([$phoneDigits, $existingCustomer['id']]);
                if ($statement->fetch()) respond(409, ['error' => 'This mobile number is already linked to another account.']);
            }
            $statement = $pdo->prepare('UPDATE customers SET name = ?, phone = ?, phone_digits = ?, address = ?, city = ?, pin = ?, addresses = ? WHERE email = ?');
            $statement->execute([
                $name,
                $phone === '' ? '' : $phoneDigits,
                $phone === '' ? '' : $phoneDigits,
                cleanText($input['address'] ?? $existingCustomer['address'], 500),
                cleanText($input['city'] ?? $existingCustomer['city'], 120),
                cleanText($input['pin'] ?? $existingCustomer['pin'], 20),
                json_encode(is_array($input['addresses'] ?? null)
                    ? $input['addresses']
                    : (json_decode($existingCustomer['addresses'] ?? '[]', true) ?: [])),
                $email,
            ]);
            respond(200, ['user' => publicCustomer(getCustomerByEmail($pdo, $email))]);

        case 'customer-address-upsert':
            requireMethod('POST');
            $input = readJson();
            $email = verifyCustomerAccount(
                $input['expectedEmail'] ?? null,
                array_key_exists('expectedEmail', $input)
            );
            $address = $input['address'] ?? null;
            if (!is_array($address)) respond(422, ['error' => 'A valid address is required.']);
            $addressId = cleanText($address['id'] ?? '', 80);
            $label = cleanText($address['label'] ?? 'Saved address', 80);
            $street = cleanText($address['address'] ?? '', 500);
            $city = cleanText($address['city'] ?? '', 120);
            $pin = cleanText($address['pin'] ?? '', 20);
            if ($addressId === '' || $street === '' || $city === '' || !preg_match('/^\d{6}$/D', $pin)) {
                respond(422, ['error' => 'Enter an address, city and valid six-digit PIN code.']);
            }
            $expectedVersion = readExpectedAddressVersion($input);
            $pdo->beginTransaction();
            try {
                $statement = $pdo->prepare('SELECT address, city, pin, addresses FROM customers WHERE email = ? FOR UPDATE');
                $statement->execute([$email]);
                $customerRow = $statement->fetch();
                if (!$customerRow) throw new ApiException(404, 'Customer account was not found.');
                $addresses = json_decode((string) ($customerRow['addresses'] ?? '[]'), true);
                if (!is_array($addresses)) $addresses = [];
                $updatedAddress = null;
                $found = false;
                $isPrimaryAddress = false;
                foreach ($addresses as $index => $savedAddress) {
                    if (is_array($savedAddress) && (string) ($savedAddress['id'] ?? '') === $addressId) {
                        $currentVersion = addressVersion($savedAddress);
                        if ($expectedVersion !== null && $expectedVersion !== $currentVersion) {
                            throw new ApiException(409, 'This address changed in another session. Refresh and retry.');
                        }
                        $updatedAddress = [
                            'id' => $addressId,
                            'label' => $label,
                            'address' => $street,
                            'city' => $city,
                            'pin' => $pin,
                            'version' => $currentVersion + 1,
                        ];
                        $addresses[$index] = $updatedAddress;
                        $isPrimaryAddress = $index === array_key_first($addresses);
                        $found = true;
                        break;
                    }
                }
                if (!$found) {
                    if ($expectedVersion !== null && $expectedVersion !== 0) {
                        throw new ApiException(409, 'This address changed in another session. Refresh and retry.');
                    }
                    $updatedAddress = [
                        'id' => $addressId,
                        'label' => $label,
                        'address' => $street,
                        'city' => $city,
                        'pin' => $pin,
                        'version' => 1,
                    ];
                    $isPrimaryAddress = $addresses === [];
                    $addresses[] = $updatedAddress;
                }
                $primaryAddress = $isPrimaryAddress ? $updatedAddress : $customerRow;
                $statement = $pdo->prepare('UPDATE customers SET address = ?, city = ?, pin = ?, addresses = ? WHERE email = ?');
                $statement->execute([
                    cleanText($primaryAddress['address'] ?? '', 500),
                    cleanText($primaryAddress['city'] ?? '', 120),
                    cleanText($primaryAddress['pin'] ?? '', 20),
                    json_encode(array_values($addresses)),
                    $email,
                ]);
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
            respond(200, ['user' => publicCustomer(getCustomerByEmail($pdo, $email))]);

        case 'customer-address-delete':
            requireMethod('POST');
            $input = readJson();
            $email = verifyCustomerAccount(
                $input['expectedEmail'] ?? null,
                array_key_exists('expectedEmail', $input)
            );
            $addressId = cleanText($input['id'] ?? '', 80);
            if ($addressId === '') respond(422, ['error' => 'Address ID is required.']);
            $expectedVersion = readExpectedAddressVersion($input);
            $pdo->beginTransaction();
            try {
                $statement = $pdo->prepare('SELECT address, city, pin, addresses FROM customers WHERE email = ? FOR UPDATE');
                $statement->execute([$email]);
                $customerRow = $statement->fetch();
                if (!$customerRow) throw new ApiException(404, 'Customer account was not found.');
                $addresses = json_decode((string) ($customerRow['addresses'] ?? '[]'), true);
                if (!is_array($addresses)) $addresses = [];
                $remainingAddresses = [];
                $found = false;
                $deletedPrimary = false;
                $firstAddressIndex = array_key_first($addresses);
                foreach ($addresses as $index => $savedAddress) {
                    if (is_array($savedAddress) && (string) ($savedAddress['id'] ?? '') === $addressId) {
                        if ($expectedVersion !== null && $expectedVersion !== addressVersion($savedAddress)) {
                            throw new ApiException(409, 'This address changed in another session. Refresh and retry.');
                        }
                        $found = true;
                        $deletedPrimary = $index === $firstAddressIndex;
                        continue;
                    }
                    $remainingAddresses[] = $savedAddress;
                }
                if (!$found) throw new ApiException(404, 'Saved address was not found.');
                $primary = $deletedPrimary && is_array($remainingAddresses[0] ?? null)
                    ? $remainingAddresses[0]
                    : $customerRow;
                $statement = $pdo->prepare('UPDATE customers SET address = ?, city = ?, pin = ?, addresses = ? WHERE email = ?');
                $statement->execute([
                    cleanText($primary['address'] ?? '', 500),
                    cleanText($primary['city'] ?? '', 120),
                    cleanText($primary['pin'] ?? '', 20),
                    json_encode(array_values($remainingAddresses)),
                    $email,
                ]);
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
            respond(200, ['user' => publicCustomer(getCustomerByEmail($pdo, $email))]);

        case 'customer-logout':
            requireMethod('POST');
            unset($_SESSION['customer_email']);
            session_regenerate_id(true);
            respond(200, ['ok' => true]);

        case 'customers-list':
            requireMethod('GET');
            requireAdmin('customers');
            $customers = $pdo->query(
                'SELECT id, name, email, phone, phone_digits, provider, providers, address, city, pin, joined_at
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

        case 'customers-update-phone':
            requireMethod('POST');
            requireAdmin('customers');
            $input = readJson();
            $customerId = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$customerId || $customerId < 1) respond(422, ['error' => 'A valid customer ID is required.']);
            $phone = cleanText($input['phone'] ?? '', 40);
            $phoneDigits = preg_replace('/\D+/', '', $phone);
            if ($phone !== '' && (strlen($phoneDigits) < 10 || strlen($phoneDigits) > 15)) {
                respond(422, ['error' => 'Phone number must contain 10 to 15 digits.']);
            }
            if ($phoneDigits !== '') {
                $duplicate = $pdo->prepare('SELECT id FROM customers WHERE phone_digits = ? AND id <> ? LIMIT 1');
                $duplicate->execute([$phoneDigits, $customerId]);
                if ($duplicate->fetchColumn()) respond(409, ['error' => 'This mobile number is already linked to another customer account.']);
            }
            $update = $pdo->prepare('UPDATE customers SET phone = ?, phone_digits = ? WHERE id = ?');
            $update->execute([$phone, $phoneDigits, $customerId]);
            if ($update->rowCount() === 0) {
                $exists = $pdo->prepare('SELECT 1 FROM customers WHERE id = ?');
                $exists->execute([$customerId]);
                if (!$exists->fetchColumn()) respond(404, ['error' => 'Customer account was not found.']);
            }
            respond(200, ['ok' => true, 'phone' => $phone]);

        case 'customers-import':
            requireMethod('POST');
            requireAdmin('customers');
            $input = readJson();
            $records = $input['customers'] ?? null;
            if (!is_array($records) || count($records) < 1 || count($records) > 500) {
                respond(422, ['error' => 'Import between 1 and 500 customer profiles at a time.']);
            }
            if (array_keys($records) !== range(0, count($records) - 1)) {
                respond(422, ['error' => 'Customer profiles must be provided as a list.']);
            }
            $createOnly = !empty($input['createOnly']);

            $normalizedRecords = [];
            $seenEmails = [];
            $seenPhones = [];
            foreach ($records as $index => $record) {
                $rowNumber = $index + 2;
                if (!is_array($record)) respond(422, ['error' => "Row {$rowNumber}: invalid customer data."]);
                $email = normalizeEmail($record['email'] ?? '');
                $name = cleanText($record['name'] ?? '', 160);
                if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $name === '') {
                    respond(422, ['error' => "Row {$rowNumber}: provide a valid email address and customer name."]);
                }
                if (isset($seenEmails[$email])) {
                    respond(422, ['error' => "Row {$rowNumber}: the email {$email} appears more than once."]);
                }
                $seenEmails[$email] = true;

                $profile = [
                    'email' => $email,
                    'name' => $name,
                    'fields' => ['name' => $name],
                ];
                foreach (['phone' => 40, 'address' => 500, 'city' => 120, 'pin' => 20] as $field => $limit) {
                    if (!array_key_exists($field, $record)) continue;
                    $value = cleanText($record[$field] ?? '', $limit);
                    $profile['fields'][$field] = $value;
                    if ($field === 'phone') {
                        $digits = preg_replace('/\D+/', '', $value);
                        if ($digits !== '' && (strlen($digits) < 10 || strlen($digits) > 15)) {
                            respond(422, ['error' => "Row {$rowNumber}: phone number must contain 10 to 15 digits."]);
                        }
                        if ($digits !== '') {
                            if (isset($seenPhones[$digits])) respond(422, ['error' => "Row {$rowNumber}: phone number appears more than once."]);
                            $seenPhones[$digits] = true;
                        }
                        $profile['phone_digits'] = $digits;
                    }
                }
                if (array_key_exists('joined', $record) && trim((string) $record['joined']) !== '') {
                    $joined = trim((string) $record['joined']);
                    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $joined)) {
                        respond(422, ['error' => "Row {$rowNumber}: joined date must use YYYY-MM-DD."]);
                    }
                    [$year, $month, $day] = array_map('intval', explode('-', $joined));
                    if (!checkdate($month, $day, $year)) respond(422, ['error' => "Row {$rowNumber}: joined date is invalid."]);
                    $profile['joined'] = $joined;
                }
                $normalizedRecords[] = $profile;
            }

            $pdo->beginTransaction();
            $created = 0;
            $updated = 0;
            $emailLookup = $pdo->prepare('SELECT id FROM customers WHERE email = ? LIMIT 1');
            $phoneLookup = $pdo->prepare('SELECT id, email FROM customers WHERE phone_digits = ? LIMIT 1');
            $updateCustomer = $pdo->prepare('UPDATE customers SET name = ?, phone = ?, phone_digits = ?, address = ?, city = ?, pin = ? WHERE id = ?');
            $insertCustomer = $pdo->prepare(
                "INSERT INTO customers (email, name, phone, phone_digits, password_hash, provider, providers, address, city, pin, addresses, joined_at)
                 VALUES (?, ?, ?, ?, NULL, 'profile', ?, ?, ?, ?, ?, ?)"
            );
            foreach ($normalizedRecords as $profile) {
                $emailLookup->execute([$profile['email']]);
                $existingId = $emailLookup->fetchColumn();
                if ($existingId !== false && $createOnly) {
                    $pdo->rollBack();
                    respond(409, ['error' => 'A customer account with this email already exists. Import the profile to update it instead.']);
                }
                $phoneDigits = $profile['phone_digits'] ?? '';
                if ($phoneDigits !== '') {
                    $phoneLookup->execute([$phoneDigits, $profile['email']]);
                    $phoneOwner = $phoneLookup->fetch();
                    if ($phoneOwner && normalizeEmail($phoneOwner['email'] ?? '') !== normalizeEmail($profile['email'])) {
                        $pdo->rollBack();
                        respond(409, ['error' => 'A phone number in this import is already linked to another customer account.']);
                    }
                }

                if ($existingId !== false) {
                    $current = $pdo->prepare('SELECT phone, phone_digits, address, city, pin FROM customers WHERE id = ?');
                    $current->execute([$existingId]);
                    $existing = $current->fetch() ?: [];
                    $resolvedPhone = array_key_exists('phone', $profile['fields'])
                        ? $profile['fields']['phone']
                        : ($existing['phone'] ?? '');
                    $resolvedPhoneDigits = array_key_exists('phone', $profile['fields'])
                        ? $phoneDigits
                        : ($existing['phone_digits'] ?? '');
                    $updateCustomer->execute([
                        $profile['fields']['name'],
                        $resolvedPhone,
                        $resolvedPhoneDigits,
                        $profile['fields']['address'] ?? ($existing['address'] ?? ''),
                        $profile['fields']['city'] ?? ($existing['city'] ?? ''),
                        $profile['fields']['pin'] ?? ($existing['pin'] ?? ''),
                        $existingId,
                    ]);
                    $updated += 1;
                } else {
                    $insertCustomer->execute([
                        $profile['email'],
                        $profile['fields']['name'],
                        $profile['fields']['phone'] ?? '',
                        $phoneDigits,
                        json_encode([]),
                        $profile['fields']['address'] ?? '',
                        $profile['fields']['city'] ?? '',
                        $profile['fields']['pin'] ?? '',
                        json_encode([]),
                        $profile['joined'] ?? date('Y-m-d'),
                    ]);
                    $created += 1;
                }
            }
            $pdo->commit();
            respond(200, ['ok' => true, 'created' => $created, 'updated' => $updated]);

        case 'customers-count':
            requireMethod('GET');
            requireAdmin('customers');
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
                $data = $shared ? $shared['data'] : null;
                $profile = currentAdminProfile();
                if (is_array($data) && !$profile['master']) {
                    if (!in_array('orders', $profile['permissions'], true)) $data['orders'] = [];
                    if (!in_array('enquiries', $profile['permissions'], true)) $data['enquiries'] = [];
                }
                respond(200, [
                    'data' => $data,
                    'revision' => $shared ? (int) $shared['revision'] : 0,
                ]);
            }
            requireMethod('PUT');
            $input = readJson();
            $data = normalizeStoreData($input['data'] ?? null);
            if (!array_key_exists('revision', $input)) {
                respond(428, ['error' => 'This admin page is outdated. Refresh it before saving shared data.']);
            }
            if (!is_numeric($input['revision']) || (int) $input['revision'] < 0) {
                respond(422, ['error' => 'The shared store revision is invalid.']);
            }
            $expectedRevision = (int) $input['revision'];
            $serialized = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($serialized === false || strlen($serialized) > MAX_SHARED_STORE_BYTES) {
                respond(413, ['error' => 'The shared store data is too large to save.']);
            }
            $previousData = null;
            $pdo->beginTransaction();
            try {
                $statement = $pdo->prepare('SELECT store_data, revision FROM shared_store WHERE store_key = ? FOR UPDATE');
                $statement->execute(['main']);
                $existing = $statement->fetch();

                if ($existing) {
                    $currentRevision = (int) $existing['revision'];
                    if ($expectedRevision !== $currentRevision) {
                        $pdo->rollBack();
                        respond(409, [
                            'error' => 'The shared store changed in another admin session. Reload the admin page before making more changes.',
                            'revision' => $currentRevision,
                        ]);
                    }

                    $currentData = json_decode($existing['store_data'], true);
                    if (!is_array($currentData)) {
                        throw new RuntimeException('Shared store data is not valid JSON.');
                    }
                    $previousData = $currentData;
                    $profile = currentAdminProfile();
                    foreach (['orders' => 'orders', 'enquiries' => 'enquiries'] as $collection => $permission) {
                        if (!$profile['master'] && !in_array($permission, $profile['permissions'], true)) {
                            $data[$collection] = $currentData[$collection] ?? [];
                        }
                    }
                    requireSharedStoreWritePermissions($currentData, $data);
                    foreach (['orders'] as $collection) {
                        if (is_array($currentData[$collection] ?? null)) {
                            $data[$collection] = array_values($currentData[$collection]);
                        }
                    }
                    synchronizeProductSalesHolds($currentData, $data);
                    rejectProductsWithActiveReservations($currentData, $data);

                    $serialized = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                    if ($serialized === false || strlen($serialized) > MAX_SHARED_STORE_BYTES) {
                        $pdo->rollBack();
                        respond(413, ['error' => 'The shared store data is too large to save.']);
                    }
                    $statement = $pdo->prepare(
                        'UPDATE shared_store SET store_data = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE store_key = ?'
                    );
                    $statement->execute([$serialized, 'main']);
                    appendAdminNotificationsForEnquiryChanges($pdo, $currentData, $data);
                    $revision = $currentRevision + 1;
                } else {
                    requireMasterAdmin();
                    if ($expectedRevision !== 0) {
                        $pdo->rollBack();
                        respond(409, [
                            'error' => 'The shared store changed in another admin session. Reload the admin page before making more changes.',
                            'revision' => 0,
                        ]);
                    }
                    $statement = $pdo->prepare(
                        'INSERT INTO shared_store (store_key, store_data, revision, updated_at) VALUES (?, ?, 1, CURRENT_TIMESTAMP)'
                    );
                    $statement->execute(['main', $serialized]);
                    $revision = 1;
                }

                $pdo->commit();
                if (is_array($previousData)) cleanupUnreferencedMedia($previousData, $data);
                respond(200, ['revision' => $revision]);
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }

        case 'order-create':
            requireMethod('POST');
            $input = readJson();
            $result = createOrderIdempotently($pdo, $input);
            respond($result['duplicate'] ? 200 : 201, [
                'order' => customerOrderView($result['order']),
                'duplicate' => $result['duplicate'],
                'revision' => $result['revision'],
            ]);

        case 'admin-order-status':
            requireMethod('POST');
            requireAdmin('orders');
            $input = readJson();
            $orderId = cleanText($input['id'] ?? '', 80);
            $status = cleanText($input['status'] ?? '', 20);
            if ($orderId === '' || !in_array($status, ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'], true)) {
                respond(422, ['error' => 'Order ID or status is invalid.']);
            }
            $result = updateSharedOrderStatus($pdo, $orderId, $status);
            if (!$result) respond(404, ['error' => 'Order not found.']);
            respond(200, ['order' => $result['order'], 'revision' => $result['revision']]);

        case 'admin-order-void':
            requireMethod('POST');
            requireMasterAdmin();
            $input = readJson();
            $orderId = cleanText($input['id'] ?? '', 80);
            $reason = cleanText($input['reason'] ?? '', 500);
            if ($orderId === '' || mb_strlen($reason, 'UTF-8') < 5) {
                respond(422, ['error' => 'Order ID and a void reason of at least 5 characters are required.']);
            }
            $result = updateSharedOrderStatus($pdo, $orderId, 'Cancelled', $reason);
            if (!$result) respond(404, ['error' => 'Order not found.']);
            respond(200, ['order' => $result['order'], 'revision' => $result['revision']]);

        case 'admin-enquiry-status':
            requireMethod('POST');
            requireAdmin('enquiries');
            $input = readJson();
            $enquiryId = cleanText($input['id'] ?? '', 80);
            $status = cleanText($input['status'] ?? '', 20);
            if ($enquiryId === '' || !in_array($status, ['New', 'Contacted', 'Closed'], true)) {
                respond(422, ['error' => 'Enquiry ID or status is invalid.']);
            }
            $result = updateSharedEnquiryStatus($pdo, $enquiryId, $status);
            if (!$result) respond(404, ['error' => 'Enquiry not found.']);
            respond(200, ['enquiry' => $result['enquiry'], 'revision' => $result['revision']]);

        case 'admin-enquiry-delete':
            requireMethod('POST');
            requireAdmin('enquiries');
            $input = readJson();
            $enquiryId = cleanText($input['id'] ?? '', 80);
            if ($enquiryId === '') respond(422, ['error' => 'Enquiry ID is required.']);
            $result = deleteSharedEnquiry($pdo, $enquiryId);
            if (!$result) respond(404, ['error' => 'Enquiry not found.']);
            respond(200, ['deleted' => true, 'id' => $enquiryId, 'revision' => $result['revision']]);

        case 'enquiry-create':
            requireMethod('POST');
            $input = readJson();
            $idempotencyKey = cleanText($input['idempotencyKey'] ?? '', 100);
            if (!preg_match('/^[A-Za-z0-9._:-]{16,100}$/D', $idempotencyKey)) {
                respond(422, ['error' => 'The enquiry submission is missing a valid retry key. Please retry the form.']);
            }
            $email = normalizeEmail($input['email'] ?? '');
            if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                respond(422, ['error' => 'Enter a valid email address.']);
            }
            $name = cleanText($input['name'] ?? '', 160);
            $message = cleanText($input['message'] ?? '', 4000);
            if ($name === '' || $message === '') {
                respond(422, ['error' => 'Name and message are required.']);
            }
            $phone = cleanText($input['phone'] ?? '', 40);
            $phoneDigits = preg_replace('/\D+/', '', $phone);
            if (!preg_match('/^[+0-9 ().-]+$/D', $phone) || strlen($phoneDigits) < 10 || strlen($phoneDigits) > 15) {
                respond(422, ['error' => 'Enter a valid phone number with 10 to 15 digits.']);
            }
            $phone = $phoneDigits;
            $subject = cleanText($input['subject'] ?? '', 200);
            $requestHash = hash('sha256', json_encode([
                'name' => $name,
                'email' => $email,
                'phone' => $phone,
                'subject' => $subject,
                'message' => $message,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            $record = [
                'id' => 'ENQ' . date('ymdHis') . strtoupper(bin2hex(random_bytes(3))),
                'name' => $name,
                'email' => $email,
                'phone' => $phone,
                'subject' => $subject,
                'message' => $message,
                'date' => date('Y-m-d'),
                'status' => 'New',
                'idempotencyKey' => $idempotencyKey,
                'idempotencyHash' => $requestHash,
            ];
            $result = appendSharedRecordIdempotently($pdo, 'enquiries', $record);
            respond($result['duplicate'] ? 200 : 201, $result);

        case 'customers-delete':
            requireMethod('POST');
            requireAdmin('customers');
            $input = readJson();
            $statement = $pdo->prepare('DELETE FROM customers WHERE id = ?');
            $statement->execute([(int) ($input['id'] ?? 0)]);
            respond(200, ['ok' => true]);

        default:
            respond(404, ['error' => 'Unknown API action.']);
    }
} catch (ApiException $error) {
    respond($error->status, ['error' => $error->getMessage()]);
} catch (Throwable $error) {
    $safeAction = preg_replace('/[^a-z0-9_-]/i', '', (string) $action);
    error_log('Suvarna API error [action=' . $safeAction . ']: ' . $error->getMessage());
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
            session_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $columnCheck = $pdo->prepare(
        'SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $columnCheck->execute(['admin_accounts', 'session_version']);
    if ((int) $columnCheck->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE admin_accounts ADD COLUMN session_version BIGINT UNSIGNED NOT NULL DEFAULT 1');
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS admin_profiles (
            email VARCHAR(254) NOT NULL PRIMARY KEY,
            name VARCHAR(160) NOT NULL,
            role VARCHAR(40) NOT NULL,
            permissions JSON NOT NULL,
            invite_hash CHAR(64) NULL,
            status VARCHAR(20) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "INSERT IGNORE INTO admin_profiles (email, name, role, permissions, status)
         SELECT email, SUBSTRING_INDEX(email, '@', 1), 'Editor', JSON_ARRAY('products', 'offers'), 'Active'
         FROM admin_accounts"
    );
    global $config;
    $masterEmail = normalizeEmail($config['master_admin_email'] ?? '');
    if ($masterEmail !== '') {
        $masterProfile = $pdo->prepare(
            "UPDATE admin_profiles SET name = 'Master Admin', role = 'Master Admin',
             permissions = ?, status = 'Active', invite_hash = NULL WHERE email = ?"
        );
        $masterProfile->execute([json_encode(ADMIN_PERMISSION_IDS), $masterEmail]);
    }
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
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS admin_notifications (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            type VARCHAR(20) NOT NULL,
            title VARCHAR(120) NOT NULL,
            summary VARCHAR(255) NOT NULL,
            href VARCHAR(255) NOT NULL,
            recipient_email VARCHAR(254) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX admin_notifications_type_id (type, id),
            INDEX admin_notifications_recipient_id (recipient_email, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $columnCheck->execute(['admin_notifications', 'recipient_email']);
    if ((int) $columnCheck->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE admin_notifications ADD COLUMN recipient_email VARCHAR(254) NULL');
    }
    $indexCheck = $pdo->prepare(
        'SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?'
    );
    $indexCheck->execute(['admin_notifications', 'admin_notifications_recipient_id']);
    if ((int) $indexCheck->fetchColumn() === 0) {
        $pdo->exec('CREATE INDEX admin_notifications_recipient_id ON admin_notifications (recipient_email, id)');
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS admin_notification_reads (
            notification_id BIGINT UNSIGNED NOT NULL,
            admin_email VARCHAR(254) NOT NULL,
            read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (notification_id, admin_email),
            INDEX admin_notification_reads_admin (admin_email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS customer_notification_reads (
            notification_id BIGINT UNSIGNED NOT NULL,
            customer_email VARCHAR(254) NOT NULL,
            read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (notification_id, customer_email),
            INDEX customer_notification_reads_customer (customer_email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS customer_password_recovery_tokens (
            token_hash CHAR(64) NOT NULL PRIMARY KEY,
            email VARCHAR(254) NOT NULL,
            expires_at DATETIME NOT NULL,
            consumed_at DATETIME NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX customer_password_recovery_email_expiry (email, expires_at)
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

function currentAdminProfile(): array
{
    global $pdo;
    if (empty($_SESSION['admin_email'])) respond(401, ['error' => 'Admin login is required.']);
    $account = $pdo->prepare('SELECT session_version FROM admin_accounts WHERE email = ?');
    $account->execute([normalizeEmail($_SESSION['admin_email'])]);
    $sessionVersion = $account->fetchColumn();
    if (
        $sessionVersion === false ||
        !isset($_SESSION['admin_session_version']) ||
        (int) $_SESSION['admin_session_version'] !== (int) $sessionVersion
    ) {
        unset($_SESSION['admin_email'], $_SESSION['admin_session_version']);
        respond(401, ['error' => 'Your admin session has expired. Please sign in again.']);
    }
    $profile = getAdminProfile($pdo, (string) $_SESSION['admin_email']);
    if (!$profile || $profile['status'] !== 'Active') {
        unset($_SESSION['admin_email']);
        unset($_SESSION['admin_session_version']);
        respond(401, ['error' => 'This admin account is inactive or no longer exists.']);
    }
    return $profile;
}

function requireAdmin(?string $permission = null): void
{
    $profile = currentAdminProfile();
    if ($permission !== null && !$profile['master'] && !in_array($permission, $profile['permissions'], true)) {
        respond(403, ['error' => 'Your admin account does not have permission to perform this action.']);
    }
}

function requireAdminAny(array $permissions): void
{
    $profile = currentAdminProfile();
    if ($profile['master']) return;
    foreach ($permissions as $permission) {
        if (in_array($permission, $profile['permissions'], true)) return;
    }
    respond(403, ['error' => 'Your admin account does not have permission to perform this action.']);
}

function requireSharedStoreWritePermissions(array $currentData, array $newData): void
{
    $permissionsByKey = [
        'categories' => 'categories',
        'products' => 'products',
        'banners' => 'banners',
        'promoCards' => 'promo-cards',
        'videos' => 'videos',
        'offers' => 'offers',
        'enquiries' => 'enquiries',
        'settings' => 'settings',
        'policies' => 'policies',
    ];
    foreach ($permissionsByKey as $key => $permission) {
        if (($currentData[$key] ?? null) !== ($newData[$key] ?? null)) {
            requireAdmin($permission);
        }
    }
}

function synchronizeProductSalesHolds(array $currentData, array &$newData): void
{
    $currentById = [];
    foreach (($currentData['products'] ?? []) as $product) {
        if (is_array($product) && isset($product['id'])) $currentById[(string) $product['id']] = $product;
    }

    foreach ($newData['products'] as &$product) {
        if (!is_array($product)) continue;
        $id = (string) ($product['id'] ?? '');
        $previous = $currentById[$id] ?? null;
        $nextStatus = strtolower(cleanText($product['stock'] ?? '', 40));
        $nextQuantity = explicitProductStockQuantity($product);
        $hasRequestedHold = array_key_exists('manualSalesHold', $product);
        $requestedHold = $hasRequestedHold && (
            $product['manualSalesHold'] === true ||
            $product['manualSalesHold'] === 1 ||
            $product['manualSalesHold'] === '1'
        );

        if (!is_array($previous)) {
            $product['manualSalesHold'] = $hasRequestedHold ? $requestedHold : productHasManualSalesHold($product);
            continue;
        }
        $previousStatus = strtolower(cleanText($previous['stock'] ?? '', 40));
        if ($previousStatus !== 'out of stock' && $nextStatus === 'out of stock' && $nextQuantity !== 0) {
            $product['manualSalesHold'] = true;
            continue;
        }
        if ($previousStatus === 'out of stock' && $nextStatus !== 'out of stock') {
            $product['manualSalesHold'] = false;
            continue;
        }
        if ($hasRequestedHold) {
            $product['manualSalesHold'] = $requestedHold;
            continue;
        }
        if (array_key_exists('manualSalesHold', $previous)) {
            $product['manualSalesHold'] = productHasManualSalesHold($previous);
            continue;
        }

        if ($nextQuantity === 0) {
            $product['manualSalesHold'] = false;
        } else {
            $product['manualSalesHold'] = productHasManualSalesHold($previous);
        }
    }
    unset($product);
}

function rejectProductsWithActiveReservations(array $currentData, array $newData): void
{
    $currentIds = [];
    foreach (($currentData['products'] ?? []) as $product) {
        if (is_array($product) && isset($product['id'])) $currentIds[(string) $product['id']] = true;
    }
    $newIds = [];
    foreach (($newData['products'] ?? []) as $product) {
        if (is_array($product) && isset($product['id'])) $newIds[(string) $product['id']] = true;
    }
    foreach (($currentData['orders'] ?? []) as $order) {
        if (!is_array($order)) continue;
        $status = strtolower(cleanText($order['status'] ?? '', 20));
        $reservationState = $order['stockReservationState'] ?? '';
        $stillNeedsProduct = $reservationState === 'reserved'
            && !in_array($status, ['cancelled', 'delivered'], true);
        if (!$stillNeedsProduct) continue;
        foreach (($order['stockReservations'] ?? []) as $reservation) {
            if (!is_array($reservation)) continue;
            $productId = (string) ($reservation['productId'] ?? '');
            if ($productId !== '' && isset($currentIds[$productId]) && !isset($newIds[$productId])) {
                throw new ApiException(409, 'A product cannot be deleted while an active order reserves its stock.');
            }
        }
    }
}

function requireMasterAdmin(): void
{
    global $config;
    requireAdmin();
    if (normalizeEmail($_SESSION['admin_email']) !== normalizeEmail($config['master_admin_email'] ?? '')) {
        respond(403, ['error' => 'Only the master admin can manage admin accounts.']);
    }
}

function normalizeAdminPermissions(mixed $permissions): array
{
    if (!is_array($permissions)) respond(422, ['error' => 'Admin permissions must be a list.']);
    return array_values(array_unique(array_filter(
        $permissions,
        static fn ($permission): bool => is_string($permission) && in_array($permission, ADMIN_PERMISSION_IDS, true)
    )));
}

function normalizeAdminProfile(array $profile): array
{
    $permissions = json_decode((string) ($profile['permissions'] ?? '[]'), true);
    return [
        'email' => normalizeEmail($profile['email'] ?? ''),
        'name' => cleanText($profile['name'] ?? '', 160),
        'role' => cleanText($profile['role'] ?? 'Editor', 40),
        'permissions' => normalizeAdminPermissions(is_array($permissions) ? $permissions : []),
        'status' => cleanText($profile['status'] ?? 'Active', 20),
        'addedAt' => cleanText($profile['addedAt'] ?? '', 10),
        'master' => cleanText($profile['role'] ?? '', 40) === 'Master Admin',
    ];
}

function getAdminProfile(PDO $pdo, string $email): array|null
{
    $statement = $pdo->prepare(
        'SELECT email, name, role, permissions, status, DATE_FORMAT(created_at, \'%Y-%m-%d\') AS addedAt
         FROM admin_profiles WHERE email = ?'
    );
    $statement->execute([normalizeEmail($email)]);
    $profile = $statement->fetch();
    return $profile ? normalizeAdminProfile($profile) : null;
}

function requireCustomer(): void
{
    if (empty($_SESSION['customer_email'])) respond(401, ['error' => 'Customer login is required.']);
}

function verifyCustomerAccount(mixed $expectedEmail = null, bool $isProvided = false): string
{
    requireCustomer();
    $sessionEmail = normalizeEmail($_SESSION['customer_email']);
    if ($sessionEmail === '') respond(401, ['error' => 'Customer login is required.']);
    if ($isProvided && !hash_equals($sessionEmail, normalizeEmail($expectedEmail))) {
        respond(409, ['error' => 'The active customer account changed. Refresh your account and try again.']);
    }
    return $sessionEmail;
}

function verifyAdminNotificationAccount(mixed $expectedEmail = null, bool $isProvided = false): string
{
    $sessionEmail = normalizeEmail($_SESSION['admin_email'] ?? '');
    if ($sessionEmail === '') respond(401, ['error' => 'Admin login is required.']);
    if ($isProvided && !hash_equals($sessionEmail, normalizeEmail($expectedEmail))) {
        respond(409, ['error' => 'The active admin account changed. Refresh and try again.']);
    }
    return $sessionEmail;
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

function mintCustomerPasswordRecoveryToken(PDO $pdo, string $email): string
{
    $token = bin2hex(random_bytes(32));
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM customer_password_recovery_tokens WHERE expires_at <= CURRENT_TIMESTAMP')->execute();
        $statement = $pdo->prepare(
            'INSERT INTO customer_password_recovery_tokens (token_hash, email, expires_at) VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE))'
        );
        $statement->execute([hash('sha256', $token), $email]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    return $token;
}

function isValidCustomerPasswordRecoveryToken(PDO $pdo, string $token): bool
{
    $statement = $pdo->prepare(
        'SELECT customers.email
         FROM customer_password_recovery_tokens AS tokens
         INNER JOIN customers ON customers.email = tokens.email
         WHERE tokens.token_hash = ? AND tokens.consumed_at IS NULL AND tokens.expires_at > CURRENT_TIMESTAMP
         LIMIT 1'
    );
    $statement->execute([hash('sha256', $token)]);
    return $statement->fetchColumn() !== false;
}

function consumeCustomerPasswordRecoveryToken(PDO $pdo, string $token, string $password): void
{
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare(
            'SELECT email, consumed_at, (expires_at > CURRENT_TIMESTAMP) AS is_valid
             FROM customer_password_recovery_tokens WHERE token_hash = ? FOR UPDATE'
        );
        $statement->execute([hash('sha256', $token)]);
        $recovery = $statement->fetch();
        if (!$recovery || $recovery['consumed_at'] !== null || !(bool) $recovery['is_valid']) {
            throw new ApiException(401, 'Password recovery request is invalid or has expired. Verify your account again.');
        }

        $email = normalizeEmail($recovery['email']);
        $account = $pdo->prepare('SELECT providers FROM customers WHERE email = ? FOR UPDATE');
        $account->execute([$email]);
        $providersJson = $account->fetchColumn();
        if ($providersJson === false) throw new ApiException(401, 'Password recovery request is invalid or has expired. Verify your account again.');

        $providers = json_decode((string) $providersJson, true) ?: [];
        if (!in_array('email', $providers, true)) $providers[] = 'email';
        $statement = $pdo->prepare('UPDATE customers SET password_hash = ?, provider = ?, providers = ? WHERE email = ?');
        $statement->execute([password_hash($password, PASSWORD_DEFAULT), 'email', json_encode($providers), $email]);
        $statement = $pdo->prepare(
            'UPDATE customer_password_recovery_tokens SET consumed_at = CURRENT_TIMESTAMP
             WHERE token_hash = ? AND consumed_at IS NULL'
        );
        $statement->execute([hash('sha256', $token)]);
        if ($statement->rowCount() !== 1) {
            throw new ApiException(401, 'Password recovery request is invalid or has expired. Verify your account again.');
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function readExpectedAddressVersion(array $input): ?int
{
    if (!array_key_exists('expectedVersion', $input)) return null;
    $version = filter_var($input['expectedVersion'], FILTER_VALIDATE_INT);
    if ($version === false || $version < 0) respond(422, ['error' => 'The expected address version is invalid.']);
    return $version;
}

function addressVersion(array $address): int
{
    $version = filter_var($address['version'] ?? 1, FILTER_VALIDATE_INT);
    return $version === false || $version < 1 ? 1 : $version;
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

function productSnapshotMatches(array $snapshot, array $product): bool
{
    $currentId = cleanText($product['id'] ?? '', 80);
    $savedProductUid = cleanText($snapshot['productUid'] ?? '', 80);
    if ($savedProductUid !== '') {
        $currentProductUid = cleanText($product['productUid'] ?? '', 80);
        return $currentProductUid !== '' && hash_equals($currentProductUid, $savedProductUid);
    }

    $savedId = cleanText($snapshot['productId'] ?? $snapshot['id'] ?? '', 80);
    if ($savedId === '' || $currentId === '' || !hash_equals($currentId, $savedId)) return false;
    $savedName = strtolower(trim((string) ($snapshot['name'] ?? '')));
    $currentName = strtolower(trim((string) ($product['name'] ?? '')));
    if ($savedName === '' || $currentName === '' || $savedName !== $currentName) return false;
    foreach (['brand', 'category'] as $field) {
        $saved = strtolower(trim((string) ($snapshot[$field] ?? '')));
        $current = strtolower(trim((string) ($product[$field] ?? '')));
        if ($saved === '' || $current === '' || $saved !== $current) return false;
    }
    return true;
}

function hasDeliveredProductOrder(PDO $pdo, string $email, string $productId, array|false|null $shared = null): bool
{
    $shared ??= getSharedStore($pdo);
    if (!$shared) return false;
    $product = null;
    foreach (($shared['data']['products'] ?? []) as $candidate) {
        if (is_array($candidate) && (string) ($candidate['id'] ?? '') === $productId) {
            $product = $candidate;
            break;
        }
    }
    if (!$product) return false;

    foreach (($shared['data']['orders'] ?? []) as $order) {
        if (!is_array($order) || normalizeEmail($order['email'] ?? '') !== $email) continue;
        if (strtolower((string) ($order['status'] ?? '')) !== 'delivered') continue;
        foreach (($order['items'] ?? []) as $item) {
            if (is_array($item) && productSnapshotMatches($item, $product)) {
                return true;
            }
        }
    }
    return false;
}

function insertAdminNotification(PDO $pdo, string $type, string $title, string $summary, string $href): void
{
    if (!$pdo->inTransaction()) {
        throw new RuntimeException('Admin notifications must be stored with their shared-store change.');
    }
    if (!in_array($type, ['order', 'enquiry'], true)) {
        throw new RuntimeException('The admin notification type is invalid.');
    }
    $statement = $pdo->prepare(
        'INSERT INTO admin_notifications (type, title, summary, href) VALUES (?, ?, ?, ?)'
    );
    $statement->execute([$type, $title, $summary, $href]);
}

function insertCustomerOrderNotification(PDO $pdo, mixed $email, string $title, string $summary, string $href): void
{
    if (!$pdo->inTransaction()) {
        throw new RuntimeException('Customer notifications must be stored with their shared-store change.');
    }
    $recipientEmail = normalizeEmail($email);
    if (!filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) return;
    $statement = $pdo->prepare(
        'INSERT INTO admin_notifications (type, title, summary, href, recipient_email) VALUES (?, ?, ?, ?, ?)'
    );
    $statement->execute(['order', $title, $summary, $href, $recipientEmail]);
}

function appendAdminNotificationsForEnquiryChanges(PDO $pdo, array $currentData, array $newData): void
{
    $currentById = [];
    foreach (($currentData['enquiries'] ?? []) as $enquiry) {
        if (is_array($enquiry) && isset($enquiry['id'])) {
            $currentById[(string) $enquiry['id']] = $enquiry;
        }
    }
    foreach (($newData['enquiries'] ?? []) as $enquiry) {
        if (!is_array($enquiry) || !isset($enquiry['id'])) continue;
        $id = (string) $enquiry['id'];
        if (!isset($currentById[$id])) {
            insertAdminNotification($pdo, 'enquiry', 'New enquiry received', 'A new enquiry is ready for review.', '/admin/enquiries');
            continue;
        }
        if (($currentById[$id]['status'] ?? null) !== ($enquiry['status'] ?? null)) {
            insertAdminNotification(
                $pdo,
                'enquiry',
                'Enquiry status updated',
                'An enquiry status changed to ' . cleanText($enquiry['status'] ?? 'updated', 20) . '.',
                '/admin/enquiries'
            );
        }
    }
}

function normalizeStoreData(mixed $data): array
{
    if (!is_array($data)) respond(422, ['error' => 'Shared store data must be an object.']);
    $normalized = [];
    foreach (['products', 'banners', 'promoCards', 'offers', 'videos', 'orders', 'enquiries'] as $key) {
        if (!is_array($data[$key] ?? null)) respond(422, ['error' => 'Invalid shared store collection: ' . $key]);
        $normalized[$key] = array_values($data[$key]);
    }
    $normalized['categories'] = array_values(is_array($data['categories'] ?? null) ? $data['categories'] : []);
    foreach (['settings', 'policies'] as $key) {
        if (!is_array($data[$key] ?? null)) respond(422, ['error' => 'Invalid shared store section: ' . $key]);
        $normalized[$key] = $data[$key];
    }
    return $normalized;
}

function explicitProductStockQuantity(array $product): ?int
{
    if (!array_key_exists('stockQuantity', $product)) return null;

    $quantity = $product['stockQuantity'];
    if (
        (is_int($quantity) && $quantity >= 0) ||
        (
            is_string($quantity) &&
            preg_match('/^(0|[1-9][0-9]*)$/D', $quantity) &&
            (
                strlen($quantity) < strlen((string) PHP_INT_MAX) ||
                (strlen($quantity) === strlen((string) PHP_INT_MAX) && strcmp($quantity, (string) PHP_INT_MAX) <= 0)
            )
        )
    ) {
        return (int) $quantity;
    }

    throw new ApiException(409, '"' . cleanText($product['name'] ?? 'A product', 160) . '" has an invalid unit count. Ask the administrator to correct its stock quantity.');
}

function productHasManualSalesHold(array $product): bool
{
    if (array_key_exists('manualSalesHold', $product)) {
        return $product['manualSalesHold'] === true || $product['manualSalesHold'] === 1 || $product['manualSalesHold'] === '1';
    }
    $quantity = explicitProductStockQuantity($product);
    return strtolower(cleanText($product['stock'] ?? '', 40)) === 'out of stock' && ($quantity === null || $quantity > 0);
}

function effectiveProductStockStatus(array $product): string
{
    $quantity = explicitProductStockQuantity($product);
    if (productHasManualSalesHold($product) || $quantity === 0) return 'Out of Stock';
    $stock = cleanText($product['stock'] ?? '', 40);
    if (
        strtolower($stock) === 'out of stock' &&
        $quantity !== null &&
        $quantity > 0 &&
        array_key_exists('manualSalesHold', $product) &&
        !productHasManualSalesHold($product)
    ) {
        return 'In Stock';
    }
    return $stock;
}

function storeMediaFile(string $mime, string|false $contents): string
{
    $extensions = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'image/avif' => 'avif',
        'video/mp4' => 'mp4',
        'video/webm' => 'webm',
    ];
    if (!isset($extensions[$mime])) {
        throw new ApiException(415, 'Unsupported media format. Use JPEG, PNG, WebP, GIF, AVIF, MP4, or WebM.');
    }
    if ($contents === false || $contents === '') {
        throw new RuntimeException('The uploaded media file could not be validated.');
    }
    $mediaDirectory = dirname(__DIR__) . '/uploads/media';
    if (!is_dir($mediaDirectory) && !mkdir($mediaDirectory, 0755, true) && !is_dir($mediaDirectory)) {
        throw new RuntimeException('Could not create the media upload directory.');
    }
    $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
    if (file_put_contents($mediaDirectory . '/' . $filename, $contents, LOCK_EX) === false) {
        throw new RuntimeException('Could not store the uploaded media file.');
    }
    return '/uploads/media/' . $filename;
}

function collectReferencedMedia(mixed $value, array &$references): void
{
    if (is_array($value)) {
        foreach ($value as $child) collectReferencedMedia($child, $references);
        return;
    }
    if (!is_string($value)) return;
    if (preg_match_all('~(?:https?://[^/]+)?(/uploads/media/[a-f0-9]{32}\.(?:jpg|png|webp|gif|avif|mp4|webm))~i', $value, $matches)) {
        foreach ($matches[1] as $path) $references[$path] = true;
    }
}

function cleanupUnreferencedMedia(array $previousData, array $currentData): void
{
    $oldReferences = [];
    $currentReferences = [];
    collectReferencedMedia($previousData, $oldReferences);
    collectReferencedMedia($currentData, $currentReferences);
    $mediaDirectory = dirname(__DIR__) . '/uploads/media';
    foreach (array_diff_key($oldReferences, $currentReferences) as $path => $_) {
        $filename = basename($path);
        if (!preg_match('/^[a-f0-9]{32}\.(?:jpg|png|webp|gif|avif|mp4|webm)$/i', $filename)) continue;
        $file = $mediaDirectory . DIRECTORY_SEPARATOR . $filename;
        if (is_file($file) && !@unlink($file)) error_log('An unreferenced uploaded media file could not be removed.');
    }
}

function externalizeEmbeddedMedia(array &$data): array
{
    $count = 0;
    $skipped = 0;
    $supportedMimes = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
        'video/mp4', 'video/webm',
    ];
    $externalize = static function (mixed &$value) use (&$count, &$skipped, $supportedMimes): void {
        if (!is_string($value) || !preg_match('/^data:(image\/(?:jpeg|png|webp|gif|avif)|video\/(?:mp4|webm));base64,(.+)$/s', $value, $matches)) return;
        $binary = base64_decode($matches[2], true);
        if ($binary === false || $binary === '') {
            $skipped += 1;
            error_log('Skipped an invalid embedded media item during shared-store migration.');
            return;
        }
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $actualMime = $finfo->buffer($binary);
        if (!is_string($actualMime) || !in_array($actualMime, $supportedMimes, true)) {
            $skipped += 1;
            error_log('Skipped an embedded media item with an unsupported or unrecognized file type during shared-store migration.');
            return;
        }
        $value = storeMediaFile($actualMime, $binary);
        $count += 1;
    };

    foreach (['products', 'banners', 'promoCards', 'videos'] as $collection) {
        if (!is_array($data[$collection] ?? null)) continue;
        foreach ($data[$collection] as &$record) {
            if (!is_array($record)) continue;
            foreach (['image', 'video'] as $field) {
                if (array_key_exists($field, $record)) $externalize($record[$field]);
            }
            if (is_array($record['images'] ?? null)) {
                foreach ($record['images'] as &$image) $externalize($image);
                unset($image);
            }
        }
        unset($record);
    }
    return ['migrated' => $count, 'skipped' => $skipped];
}

function createOrderIdempotently(PDO $pdo, array $input): array
{
    $idempotencyKey = cleanText($input['idempotencyKey'] ?? '', 100);
    if (!preg_match('/^[A-Za-z0-9._:-]{16,100}$/D', $idempotencyKey)) {
        throw new ApiException(422, 'The checkout request is missing a valid retry key. Refresh checkout and try again.');
    }

    $items = $input['items'] ?? null;
    $total = $input['total'] ?? null;
    if (!is_array($items) || count($items) < 1 || count($items) > 100 || !is_numeric($total) || !is_finite((float) $total) || (float) $total < 0) {
        throw new ApiException(422, 'Order details are invalid. Please review your cart and try again.');
    }

    $email = normalizeEmail($input['email'] ?? '');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new ApiException(422, 'Enter a valid contact email address.');
    }
    $payment = strtolower(cleanText($input['payment'] ?? '', 20));
    if ($payment !== 'cod') {
        throw new ApiException(422, 'The selected payment method is not available.');
    }

    $customer = cleanText($input['customer'] ?? '', 160);
    $phone = cleanText($input['phone'] ?? '', 40);
    $shippingAddress = normalizeAddress($input['shippingAddress'] ?? []);
    if ($customer === '') {
        throw new ApiException(422, 'Enter the customer name before placing the order.');
    }
    if (!preg_match('/^\+?[0-9]{10,15}$/D', $phone)) {
        throw new ApiException(422, 'Enter a valid mobile number with 10 to 15 digits.');
    }
    if (($shippingAddress['address'] ?? '') === '') {
        throw new ApiException(422, 'Enter the delivery address before placing the order.');
    }
    if (($shippingAddress['city'] ?? '') === '') {
        throw new ApiException(422, 'Enter the delivery city before placing the order.');
    }
    if (!preg_match('/^[0-9]{6}$/D', $shippingAddress['pin'] ?? '')) {
        throw new ApiException(422, 'Enter a valid six-digit delivery PIN code.');
    }
    $requestedItems = [];
    $seenProductIds = [];

    foreach ($items as $item) {
        if (!is_array($item)) {
            throw new ApiException(422, 'Order contains an invalid product.');
        }
        $productId = cleanText($item['id'] ?? '', 80);
        $quantity = $item['qty'] ?? null;
        $clientPrice = $item['price'] ?? null;
        if ($productId === '' || !is_int($quantity) || $quantity < 1 || $quantity > 10 || !is_numeric($clientPrice) || !is_finite((float) $clientPrice) || (float) $clientPrice <= 0) {
            throw new ApiException(422, 'A product quantity or price is invalid. Review your cart and try again.');
        }
        if (isset($seenProductIds[$productId])) {
            throw new ApiException(422, 'The cart contains the same product more than once. Review your cart and try again.');
        }
        $seenProductIds[$productId] = true;
        $requestedItems[] = [
            'id' => $productId,
            'qty' => $quantity,
            'pricePaise' => (int) round((float) $clientPrice * 100),
        ];
    }

    $clientTotalPaise = (int) round((float) $total * 100);
    $requestFingerprint = json_encode([
        'customer' => $customer,
        'phone' => $phone,
        'email' => $email,
        'items' => $requestedItems,
        'totalPaise' => $clientTotalPaise,
        'payment' => 'cod',
        'shippingAddress' => $shippingAddress,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($requestFingerprint === false) {
        throw new ApiException(422, 'Order details could not be validated. Please review your checkout information.');
    }
    $requestHash = hash('sha256', $requestFingerprint);

    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare('SELECT store_data, revision FROM shared_store WHERE store_key = ? FOR UPDATE');
        $statement->execute(['main']);
        $shared = $statement->fetch();
        if (!$shared) {
            throw new ApiException(503, 'Store setup is not complete. Please try again later.');
        }
        $data = json_decode($shared['store_data'], true);
        if (!is_array($data) || !is_array($data['orders'] ?? null) || !is_array($data['products'] ?? null)) {
            throw new RuntimeException('Shared store is missing the products or orders collection.');
        }

        foreach ($data['orders'] as $existingOrder) {
            if (!is_array($existingOrder) || !hash_equals((string) ($existingOrder['idempotencyKey'] ?? ''), $idempotencyKey)) {
                continue;
            }
            if (!hash_equals((string) ($existingOrder['idempotencyHash'] ?? ''), $requestHash)) {
                throw new ApiException(409, 'This checkout retry key was already used for different order details. Review your cart and retry.');
            }
            $pdo->commit();
            return ['order' => $existingOrder, 'duplicate' => true, 'revision' => (int) $shared['revision']];
        }

        $normalizedItems = [];
        $stockReservations = [];
        $subtotalPaise = 0;
        foreach ($requestedItems as $requestedItem) {
            $product = null;
            $productIndex = null;
            foreach ($data['products'] as $index => $candidate) {
                if (is_array($candidate) && (string) ($candidate['id'] ?? '') === $requestedItem['id']) {
                    $product = $candidate;
                    $productIndex = $index;
                    break;
                }
            }
            if (!$product || !isPublishableProduct($product)) {
                throw new ApiException(409, 'A product in your cart is no longer available. Remove it and review your cart.');
            }

            $stock = effectiveProductStockStatus($product);
            if (!in_array(strtolower($stock), ['in stock', 'limited stock'], true)) {
                throw new ApiException(409, '"' . cleanText($product['name'] ?? 'A product', 160) . '" is out of stock. Remove it or contact us for availability.');
            }
            $availableQuantity = explicitProductStockQuantity($product);
            if ($availableQuantity === null && strtolower($stock) === 'limited stock') {
                throw new ApiException(409, '"' . cleanText($product['name'] ?? 'A product', 160) . '" is marked Limited Stock but has no unit count. Ask the administrator to set its inventory quantity before ordering.');
            }
            if ($availableQuantity !== null) {
                if ($availableQuantity < $requestedItem['qty']) {
                    throw new ApiException(409, '"' . cleanText($product['name'] ?? 'A product', 160) . '" has only ' . $availableQuantity . ' unit(s) available. Reduce the quantity or contact us for availability.');
                }
                $remainingQuantity = $availableQuantity - $requestedItem['qty'];
                $data['products'][$productIndex]['stockQuantity'] = $remainingQuantity;
                $data['products'][$productIndex]['manualSalesHold'] = false;
                if ($remainingQuantity === 0) {
                    $data['products'][$productIndex]['stock'] = 'Out of Stock';
                }
                $stockReservations[] = [
                    'productId' => $requestedItem['id'],
                    'quantity' => $requestedItem['qty'],
                    'stockStatusBefore' => strtolower($stock) === 'limited stock' ? 'Limited Stock' : 'In Stock',
                    'exhaustedStock' => $remainingQuantity === 0,
                ];
            }
            $catalogPrice = $product['price'] ?? null;
            if (!is_numeric($catalogPrice) || !is_finite((float) $catalogPrice) || (float) $catalogPrice <= 0) {
                throw new RuntimeException('A published product has an invalid price.');
            }
            $pricePaise = (int) round((float) $catalogPrice * 100);
            if ($requestedItem['pricePaise'] !== $pricePaise) {
                throw new ApiException(409, 'A product price changed while you were checking out. Review your cart and try again.');
            }

            $subtotalPaise += $pricePaise * $requestedItem['qty'];
            $productUid = cleanText($product['productUid'] ?? '', 80);
            if ($productUid === '') {
                $productUid = 'PU' . strtoupper(bin2hex(random_bytes(16)));
                $data['products'][$productIndex]['productUid'] = $productUid;
                $product['productUid'] = $productUid;
            }
            $images = $product['images'] ?? [];
            $image = $product['image'] ?? (is_array($images) ? ($images[0] ?? '') : '');
            $oldPrice = $product['oldPrice'] ?? $catalogPrice;
            $normalizedItems[] = [
                'id' => $requestedItem['id'],
                'productId' => $requestedItem['id'],
                'productUid' => $productUid,
                'name' => cleanText($product['name'] ?? 'Product', 200),
                'qty' => $requestedItem['qty'],
                'price' => round($pricePaise / 100, 2),
                'brand' => cleanText($product['brand'] ?? '', 100),
                'category' => cleanText($product['category'] ?? '', 100),
                'image' => cleanText($image, 500000),
                'oldPrice' => is_numeric($oldPrice) ? max(0, round((float) $oldPrice, 2)) : round($pricePaise / 100, 2),
                'stock' => $stock,
            ];
        }

        $deliveryPaise = $subtotalPaise > 0 && $subtotalPaise < 5_000_000 ? 49_900 : 0;
        $expectedTotalPaise = $subtotalPaise + $deliveryPaise;
        if ($clientTotalPaise !== $expectedTotalPaise) {
            throw new ApiException(409, 'Your order total changed. Review the updated prices and delivery fee before placing the order.');
        }

        $record = [
            'id' => 'SIE' . date('ymdHis') . strtoupper(bin2hex(random_bytes(3))),
            'customer' => $customer,
            'phone' => $phone,
            'email' => $email,
            'items' => $normalizedItems,
            'total' => round($expectedTotalPaise / 100, 2),
            'payment' => 'cod',
            'shippingAddress' => $shippingAddress,
            'sellerSnapshot' => sellerSnapshotFromSettings($data['settings'] ?? []),
            'date' => date('Y-m-d'),
            'status' => 'Pending',
            'idempotencyKey' => $idempotencyKey,
            'idempotencyHash' => $requestHash,
        ];
        if ($stockReservations !== []) {
            $record['stockReservations'] = $stockReservations;
            $record['stockReservationState'] = 'reserved';
        }
        array_unshift($data['orders'], $record);
        $updated = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($updated === false || strlen($updated) > MAX_SHARED_STORE_BYTES) {
            throw new ApiException(413, 'Store data is too large to save this order. Please contact us.');
        }
        $statement = $pdo->prepare('UPDATE shared_store SET store_data = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE store_key = ?');
        $statement->execute([$updated, 'main']);
        insertAdminNotification($pdo, 'order', 'New order received', 'A new order is ready for review.', '/admin/orders');
        insertCustomerOrderNotification(
            $pdo,
            $record['email'],
            'Order confirmed',
            'Order #' . cleanText($record['id'], 80) . ' has been received.',
            '/account?tab=orders'
        );
        $pdo->commit();
        return ['order' => $record, 'duplicate' => false, 'revision' => (int) $shared['revision'] + 1];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
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
        if ($updated === false || strlen($updated) > MAX_SHARED_STORE_BYTES) {
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

function appendSharedRecordIdempotently(PDO $pdo, string $collection, array $record): array
{
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare('SELECT store_data, revision FROM shared_store WHERE store_key = ? FOR UPDATE');
        $statement->execute(['main']);
        $shared = $statement->fetch();
        if (!$shared) {
            throw new ApiException(503, 'Store setup is not complete. Ask the administrator to initialize the shared store.');
        }
        $data = json_decode($shared['store_data'], true);
        if (!is_array($data) || !is_array($data[$collection] ?? null)) {
            throw new RuntimeException('Shared store is missing the ' . $collection . ' collection.');
        }
        foreach ($data[$collection] as $existing) {
            if (
                is_array($existing) &&
                hash_equals((string) ($existing['idempotencyKey'] ?? ''), (string) ($record['idempotencyKey'] ?? ''))
            ) {
                if (!hash_equals((string) ($existing['idempotencyHash'] ?? ''), (string) ($record['idempotencyHash'] ?? ''))) {
                    throw new ApiException(409, 'This retry key was already used for different enquiry details. Review the form and submit again.');
                }
                $pdo->commit();
                return ['enquiry' => $existing, 'duplicate' => true, 'revision' => (int) $shared['revision']];
            }
        }

        array_unshift($data[$collection], $record);
        $updated = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($updated === false || strlen($updated) > MAX_SHARED_STORE_BYTES) {
            throw new ApiException(413, 'Store data is too large to add this enquiry.');
        }
        $statement = $pdo->prepare('UPDATE shared_store SET store_data = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE store_key = ?');
        $statement->execute([$updated, 'main']);
        if ($collection === 'enquiries') {
            insertAdminNotification($pdo, 'enquiry', 'New enquiry received', 'A new enquiry is ready for review.', '/admin/enquiries');
        }
        $pdo->commit();
        return ['enquiry' => $record, 'duplicate' => false, 'revision' => (int) $shared['revision'] + 1];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function updateSharedEnquiryStatus(PDO $pdo, string $enquiryId, string $status): array|false
{
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare('SELECT store_data, revision FROM shared_store WHERE store_key = ? FOR UPDATE');
        $statement->execute(['main']);
        $shared = $statement->fetch();
        if (!$shared) {
            $pdo->rollBack();
            return false;
        }
        $data = json_decode($shared['store_data'], true);
        if (!is_array($data) || !is_array($data['enquiries'] ?? null)) {
            throw new RuntimeException('Shared store is missing the enquiries collection.');
        }
        $updatedEnquiry = false;
        $statusChanged = false;
        foreach ($data['enquiries'] as &$enquiry) {
            if (is_array($enquiry) && (string) ($enquiry['id'] ?? '') === $enquiryId) {
                if ((string) ($enquiry['status'] ?? '') === $status) {
                    $updatedEnquiry = $enquiry;
                    break;
                }
                $enquiry['status'] = $status;
                $updatedEnquiry = $enquiry;
                $statusChanged = true;
                break;
            }
        }
        unset($enquiry);
        if (!$updatedEnquiry) {
            $pdo->rollBack();
            return false;
        }
        if (!$statusChanged) {
            $pdo->commit();
            return ['enquiry' => $updatedEnquiry, 'revision' => (int) $shared['revision']];
        }
        $updated = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($updated === false || strlen($updated) > MAX_SHARED_STORE_BYTES) {
            throw new ApiException(413, 'Store data is too large to update this enquiry.');
        }
        $statement = $pdo->prepare('UPDATE shared_store SET store_data = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE store_key = ?');
        $statement->execute([$updated, 'main']);
        insertAdminNotification($pdo, 'enquiry', 'Enquiry status updated', 'An enquiry status changed to ' . $status . '.', '/admin/enquiries');
        $pdo->commit();
        return ['enquiry' => $updatedEnquiry, 'revision' => (int) $shared['revision'] + 1];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function deleteSharedEnquiry(PDO $pdo, string $enquiryId): array|false
{
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare('SELECT store_data, revision FROM shared_store WHERE store_key = ? FOR UPDATE');
        $statement->execute(['main']);
        $shared = $statement->fetch();
        if (!$shared) {
            $pdo->rollBack();
            return false;
        }
        $data = json_decode($shared['store_data'], true);
        if (!is_array($data) || !is_array($data['enquiries'] ?? null)) {
            throw new RuntimeException('Shared store is missing the enquiries collection.');
        }
        $deleted = false;
        foreach ($data['enquiries'] as $index => $enquiry) {
            if (is_array($enquiry) && (string) ($enquiry['id'] ?? '') === $enquiryId) {
                array_splice($data['enquiries'], $index, 1);
                $deleted = true;
                break;
            }
        }
        if (!$deleted) {
            $pdo->rollBack();
            return false;
        }
        $updated = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($updated === false || strlen($updated) > MAX_SHARED_STORE_BYTES) {
            throw new ApiException(413, 'Store data is too large to delete this enquiry.');
        }
        $statement = $pdo->prepare('UPDATE shared_store SET store_data = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE store_key = ?');
        $statement->execute([$updated, 'main']);
        insertAdminNotification($pdo, 'enquiry', 'Enquiry removed', 'An enquiry was removed from the inbox.', '/admin/enquiries');
        $pdo->commit();
        return ['revision' => (int) $shared['revision'] + 1];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function updateSharedOrderStatus(PDO $pdo, string $orderId, string $status, ?string $voidReason = null): array|false
{
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare('SELECT store_data, revision FROM shared_store WHERE store_key = ? FOR UPDATE');
        $statement->execute(['main']);
        $shared = $statement->fetch();
        if (!$shared) {
            $pdo->rollBack();
            return false;
        }
        $data = json_decode($shared['store_data'], true);
        if (!is_array($data) || !is_array($data['orders'] ?? null)) {
            throw new RuntimeException('Shared store is missing the orders collection.');
        }
        $updatedOrder = false;
        $statusChanged = false;
        foreach ($data['orders'] as &$order) {
            if ((string) ($order['id'] ?? '') === $orderId) {
                $previousStatus = (string) ($order['status'] ?? '');
                if ($voidReason !== null && !empty($order['voidedAt'])) {
                    $updatedOrder = $order;
                    break;
                }
                if ($previousStatus === $status && $voidReason === null) {
                    $updatedOrder = $order;
                    break;
                }
                if ($previousStatus === 'Delivered' && $status !== 'Delivered') {
                    throw new ApiException(409, 'A delivered order cannot be changed through this status update.');
                }
                $reservations = $order['stockReservations'] ?? [];
                $reservationState = $order['stockReservationState'] ?? '';
                if (!is_array($reservations)) {
                    throw new RuntimeException('An order has invalid stock reservation data.');
                }

                if ($reservations !== [] && $previousStatus !== $status) {
                    $releaseStock = $status === 'Cancelled' && $previousStatus !== 'Cancelled' && $reservationState === 'reserved';
                    $reReserveStock = $previousStatus === 'Cancelled' && $status !== 'Cancelled' && $reservationState === 'released';
                    if ($releaseStock || $reReserveStock) {
                        foreach ($reservations as $reservationIndex => $reservation) {
                            if (
                                !is_array($reservation) ||
                                !is_string($reservation['productId'] ?? null) ||
                                !is_int($reservation['quantity'] ?? null) ||
                                $reservation['quantity'] < 1 ||
                                !in_array($reservation['stockStatusBefore'] ?? null, ['In Stock', 'Limited Stock'], true) ||
                                !is_bool($reservation['exhaustedStock'] ?? null)
                            ) {
                                throw new RuntimeException('An order has invalid stock reservation data.');
                            }
                            $productIndex = null;
                            foreach ($data['products'] ?? [] as $index => $product) {
                                if (is_array($product) && (string) ($product['id'] ?? '') === $reservation['productId']) {
                                    $productIndex = $index;
                                    break;
                                }
                            }
                            if ($productIndex === null && $releaseStock) {
                                continue;
                            }
                            if ($productIndex === null) {
                                throw new ApiException(409, 'Stock for this order can no longer be updated because a reserved product is missing.');
                            }
                            $availableQuantity = explicitProductStockQuantity($data['products'][$productIndex]);
                            if ($availableQuantity === null) {
                                throw new ApiException(409, 'Stock for this order can no longer be updated because a reserved product no longer has a unit count.');
                            }
                            if ($releaseStock) {
                                if ($availableQuantity > PHP_INT_MAX - $reservation['quantity']) {
                                    throw new ApiException(409, 'Stock for this order cannot be restored safely. Ask the administrator to review the product quantity.');
                                }
                                $restoredQuantity = $availableQuantity + $reservation['quantity'];
                                $product = $data['products'][$productIndex];
                                $manualHold = productHasManualSalesHold($product);
                                if (
                                    !array_key_exists('manualSalesHold', $product) &&
                                    $reservation['exhaustedStock'] &&
                                    strtolower(cleanText($product['stock'] ?? '', 40)) === 'out of stock'
                                ) {
                                    $manualHold = false;
                                }
                                $data['products'][$productIndex]['stockQuantity'] = $restoredQuantity;
                                $data['products'][$productIndex]['manualSalesHold'] = $manualHold;
                                if (
                                    !$manualHold &&
                                    $restoredQuantity > 0 &&
                                    strtolower(cleanText($data['products'][$productIndex]['stock'] ?? '', 40)) === 'out of stock'
                                ) {
                                    $data['products'][$productIndex]['stock'] = $reservation['stockStatusBefore'];
                                }
                            } else {
                                $stockStatusBefore = effectiveProductStockStatus($data['products'][$productIndex]);
                                $stock = strtolower($stockStatusBefore);
                                if (!in_array($stock, ['in stock', 'limited stock'], true) || $availableQuantity < $reservation['quantity']) {
                                    throw new ApiException(409, 'This order cannot be reopened because the reserved product no longer has enough available units.');
                                }
                                $remainingQuantity = $availableQuantity - $reservation['quantity'];
                                $data['products'][$productIndex]['stockQuantity'] = $remainingQuantity;
                                $data['products'][$productIndex]['manualSalesHold'] = false;
                                if ($remainingQuantity === 0) {
                                    $data['products'][$productIndex]['stock'] = 'Out of Stock';
                                }
                                $reservation['stockStatusBefore'] = $stock === 'limited stock' ? 'Limited Stock' : 'In Stock';
                                $reservation['exhaustedStock'] = $remainingQuantity === 0;
                                $reservations[$reservationIndex] = $reservation;
                            }
                        }
                        $order['stockReservations'] = $reservations;
                        $order['stockReservationState'] = $releaseStock ? 'released' : 'reserved';
                    }
                }
                $order['status'] = $status;
                if ($voidReason !== null) {
                    $order['voidedAt'] = gmdate('c');
                    $order['voidedBy'] = normalizeEmail($_SESSION['admin_email'] ?? '');
                    $order['voidReason'] = $voidReason;
                }
                $updatedOrder = $order;
                $statusChanged = true;
                break;
            }
        }
        unset($order);
        if (!$updatedOrder) {
            $pdo->rollBack();
            return false;
        }
        if (!$statusChanged) {
            $pdo->commit();
            return ['order' => $updatedOrder, 'revision' => (int) $shared['revision']];
        }
        $updated = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($updated === false || strlen($updated) > MAX_SHARED_STORE_BYTES) {
            $pdo->rollBack();
            respond(413, ['error' => 'Store data is too large to update this order.']);
        }
        $statement = $pdo->prepare('UPDATE shared_store SET store_data = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE store_key = ?');
        $statement->execute([$updated, 'main']);
        insertAdminNotification($pdo, 'order', 'Order status updated', 'An order status changed to ' . $status . '.', '/admin/orders');
        insertCustomerOrderNotification(
            $pdo,
            $updatedOrder['email'] ?? '',
            'Order ' . strtolower($status),
            'Order #' . cleanText($updatedOrder['id'] ?? '', 80) . ' is now ' . strtolower($status) . '.',
            '/account?tab=orders'
        );
        $pdo->commit();
        return ['order' => $updatedOrder, 'revision' => (int) $shared['revision'] + 1];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
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
    foreach (['products', 'categories', 'banners', 'promoCards', 'offers', 'videos', 'settings', 'policies'] as $key) {
        if (array_key_exists($key, $data)) {
            $public[$key] = $key === 'products'
                ? array_map('publicProduct', array_values(array_filter($data[$key], 'isPublishableProduct')))
                : ($key === 'videos'
                    ? (is_array($data[$key]) ? array_values(array_filter(
                        $data[$key],
                        static fn ($video): bool => is_array($video) &&
                            ($video['active'] ?? false) === true &&
                            is_string($video['youtubeId'] ?? null) &&
                            preg_match('/^[A-Za-z0-9_-]{11}$/D', $video['youtubeId']) === 1
                    )) : [])
                    : $data[$key]);
        }
    }
    return $public;
}

function publicProduct(mixed $product): mixed
{
    if (!is_array($product)) return $product;
    $quantity = explicitProductStockQuantity($product);
    $manualHold = productHasManualSalesHold($product);
    $product['manualSalesHold'] = $manualHold;
    if (!$manualHold && $quantity === 0) {
        $product['stock'] = 'Out of Stock';
    } elseif (!$manualHold && $quantity !== null && $quantity > 0 && strtolower(cleanText($product['stock'] ?? '', 40)) === 'out of stock') {
        $product['stock'] = 'In Stock';
    }
    return $product;
}

function sellerSnapshotFromSettings(mixed $settings): array
{
    if (!is_array($settings)) $settings = [];
    return [
        'storeName' => cleanText($settings['storeName'] ?? 'Suvarna IT Enterprises', 160),
        'email' => cleanText($settings['email'] ?? '', 254),
        'phone' => cleanText($settings['phone'] ?? '', 40),
        'whatsapp' => cleanText($settings['whatsapp'] ?? '', 40),
        'address' => cleanText($settings['address'] ?? '', 500),
    ];
}

function isPublishableProduct(mixed $product): bool
{
    if (!is_array($product)) return false;
    $name = trim((string) ($product['name'] ?? ''));
    $brand = trim((string) ($product['brand'] ?? ''));
    $description = trim((string) ($product['description'] ?? ''));
    $specs = $product['specs'] ?? null;
    if ($name === '' || $brand === '' || !is_array($specs)) return false;
    if (function_exists('array_is_list') ? array_is_list($specs) : array_keys($specs) === range(0, count($specs) - 1)) return false;
    if (mb_strlen($description) < 20 || mb_strtolower($description, 'UTF-8') === mb_strtolower($name, 'UTF-8')) return false;
    $validSpecs = array_filter($specs, static function ($value): bool {
        if (!is_scalar($value)) return false;
        $value = trim((string) $value);
        return $value !== '' && !preg_match('/^(configuration available|available)$/i', $value);
    });
    if (count($validSpecs) < 2) return false;
    if (strtolower(trim((string) ($product['category'] ?? ''))) === 'laptops') {
        $processor = is_scalar($specs['processor'] ?? null) ? (string) $specs['processor'] : '';
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
        'phone' => $customer['phone'] ?: ($customer['phone_digits'] ?? ''),
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

function customerOrderView(mixed $order): array
{
    if (!is_array($order)) return [];
    $items = [];
    foreach (($order['items'] ?? []) as $item) {
        if (!is_array($item)) continue;
        $items[] = array_intersect_key($item, array_flip([
            'id', 'name', 'brand', 'category', 'qty', 'price', 'oldPrice', 'image', 'stock',
        ]));
    }
    $view = array_intersect_key($order, array_flip([
        'id', 'customer', 'phone', 'email', 'total', 'payment', 'shippingAddress', 'date', 'status', 'sellerSnapshot',
    ]));
    $view['items'] = $items;
    $view['shippingAddress'] = is_array($view['shippingAddress'] ?? null)
        ? array_intersect_key($view['shippingAddress'], array_flip(['address', 'city', 'pin']))
        : [];
    $view['sellerSnapshot'] = is_array($view['sellerSnapshot'] ?? null)
        ? array_intersect_key($view['sellerSnapshot'], array_flip(['storeName', 'businessName', 'email', 'phone', 'whatsapp', 'address']))
        : [];
    return $view;
}

function setCustomerSession(array $customer): void
{
    session_regenerate_id(true);
    unset($_SESSION['admin_email']);
    unset($_SESSION['admin_session_version']);
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
