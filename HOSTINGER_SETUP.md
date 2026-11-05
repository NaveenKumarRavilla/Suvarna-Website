# Hostinger setup

Customer accounts, products, banners, promo cards, offers, videos, orders, enquiries, store settings, policies, and verified product reviews use the PHP/MySQL API in `public/api`. Review tables are created automatically; only signed-in customers with a delivered order for a product can submit a review. Storefront content is readable by visitors; admin data and customer lists require an admin server session. Admin edits sync across browsers, with storefront updates polling about every 30 seconds and admin data and customer order statuses about every 15 seconds. Order status changes are written directly to the shared database.

1. In Hostinger hPanel, create a MySQL database and user, and make sure the domain has PHP 8.1+ with PDO MySQL enabled.
2. Build the site with `npm run build`, then upload the **contents** of `dist` to the domain's `public_html` directory. Keep the included `.htaccess` and `api` directory.
3. In `public_html/api`, copy `config.example.php` to `config.php`. Fill in the Hostinger database host, database name, database username, and database password. Set `google_client_id` to the same OAuth client ID used by `src/config/googleAuth.js`.
4. Replace `admin_setup_key` with a long, random value. Keep `config.php` private; it is ignored by Git. Never put database credentials in frontend code or send them in chat.
5. Open [Admin Login](https://suvarnaitenterprises.com/admin/login), choose **First-time Hostinger setup**, and enter the configured master admin email, a new password, and the one-time setup key. The API creates its tables automatically and stores passwords as hashes. After setup succeeds, clear `admin_setup_key` from `config.php`.
6. Log in normally afterward. View or refresh customers at [Admin Customer Management](https://suvarnaitenterprises.com/admin/customers).

The initial setup key is only accepted before the first master admin exists. If configuration returns an API error, check the Hostinger PHP error log and verify database permissions and PHP PDO MySQL support.

If the shared store has no data yet, its first admin login initializes it from that browser's current store snapshot. Other devices' local-only edits cannot be merged automatically. Email/password accounts stored only in individual browsers cannot be recovered; those customers must register again. Google customers can sign in to create/update their shared record.
