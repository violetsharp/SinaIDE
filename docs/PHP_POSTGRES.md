# Your PHP, HTML, CSS and PostgreSQL workspace

SinaIDE's Workbench edits PHP, HTML, CSS, JavaScript, JSON and SQL with Monaco. The File Garden opens your existing PAP folder. The Basement runs your installed tools and provides an interactive PostgreSQL `psql` session. The Web view displays a local development server. PHP and PostgreSQL are separate installations; they are not included in SinaIDE's installer.

## Prepare your computer

Install a supported PHP CLI build with the extensions your application needs. Install PostgreSQL (or use your existing server), including its `psql` client. Start/configure the database server through that installation. Install Git and Composer separately if the project uses them. Use the [PHP installation manual](https://www.php.net/manual/en/install.php) and [PostgreSQL downloads](https://www.postgresql.org/download/) for your platform.

Open the project folder in the File Garden, then choose **Basement → Check web tools**. This explicitly runs PHP/psql version checks and checks whether PHP's `pdo_pgsql` extension is loaded; it does not install or start the database. If you just changed PATH, restart SinaIDE so it inherits the new environment.

Tool discovery searches the app's PATH. On Windows it also looks for `psql.exe` in numbered `%ProgramFiles%\PostgreSQL\<version>\bin` directories. On macOS it checks `/opt/homebrew/bin`, `/usr/local/bin`, and the corresponding Homebrew `opt/libpq/bin` paths for apps launched from Finder. Other locations can be entered as full paths in the executable fields. An executable path is one field; do not add shell quotes around it. Arguments are a JSON array, which keeps spaces in paths intact.

## Edit and run the website

1. Open files in the Workbench. Tabs preserve separate buffers. Save before running tools; PHP reads the files on disk.
2. Open the Basement and choose **PHP + PostgreSQL** or **PHP server**. These presets prepare the tool fields; review them and choose **Run** to start the server.
3. The default arguments are `["-S","127.0.0.1:8000","-t","."]` in the project root. If the app's web root is `public`, change the final argument to `public`. Projects with a router script or framework-specific command need their actual documented arguments.
4. Choose **Web preview**, enter `http://127.0.0.1:8000`, and choose **Load**. The preview accepts local HTTP addresses and is isolated from the native IDE commands. It does not start a server by itself.
5. Inspect server output in the Basement. Stop the task or close its session when finished. Use **PHP syntax check** on a saved PHP file to run `php -l` against it.

PHP's built-in server is intended for local development, not public deployment. Keep its loopback address for this workflow. See [PHP's development server manual](https://www.php.net/manual/en/features.commandline.webserver.php).

## Enable PHP's PostgreSQL driver

An application using PDO needs **`pdo_pgsql`**. Loading the separate `pgsql` extension alone does not provide PDO's PostgreSQL driver. The status check does not prove that a database is reachable or that credentials/schema are correct. See [PHP's PDO PostgreSQL manual](https://www.php.net/manual/en/ref.pdo-pgsql.php).

On Windows, **PHP + PostgreSQL** can prepare per-process `-d` options when the installed PHP `ext` directory contains both driver DLLs. A typical editable argument array is:

```json
["-d","extension_dir=C:\\path\\to\\php\\ext","-d","extension=pdo_pgsql","-d","extension=pgsql","-S","127.0.0.1:8000","-t","."]
```

Use the directory belonging to the selected PHP executable. If only PDO's DLL is installed, add just the `extension=pdo_pgsql` pair yourself. DLL architecture/version and dependent libraries must match PHP. These flags apply only to the launched process; SinaIDE does not change the system `php.ini`. On macOS, enable/install `pdo_pgsql` using the PHP distribution's own configuration; the Windows DLL flags do not apply.

To inspect PDO drivers without connecting to a database, run the selected PHP executable in the Basement with:

```json
["-r","echo implode(', ', PDO::getAvailableDrivers());"]
```

Include the same `-d` options before `-r` if you are testing per-process Windows extensions. `pgsql` must appear in the PDO driver list. Application database credentials remain part of the project's own environment/configuration; SinaIDE does not manage them. Keep local secrets out of Git and do not paste passwords into task arguments.

## Use PostgreSQL in the Basement

Expand **PostgreSQL · interactive psql connection**, review the executable, host, port, database and user, then choose **Connect**. The app starts an interactive terminal with `psql -X -P pager=off -h <host> -p <port> -U <user> -d <database> -W`. Enter the password directly in psql's prompt. The connection form has no saved password field. The preset skips startup psqlrc files and disables external pagers for predictable terminal behavior; edit arguments in a custom terminal task if you need different settings.

The database must already exist and the PostgreSQL server must be running. The terminal is a real database client; submitted SQL affects that database. Use `\conninfo` to inspect the connection and `\q` to quit. For an existing SQL migration, use the project's migration tool or `\i relative/path.sql` in psql after reviewing it. This is an interactive client, not a database administration GUI. See [psql's official manual](https://www.postgresql.org/docs/current/app-psql.html).

## Language tools and debugging

Monaco supplies built-in HTML/CSS/JavaScript services and PHP/SQL syntax highlighting. Rich PHP diagnostics/navigation require an external language server. The Observatory's **tools** tab allows an installed server executable and JSON arguments; its PHP preset prepares `phpactor` with `["language-server"]`. Installation, platform compatibility and any runtime dependencies belong to that server. A missing executable produces an error rather than an automatic download.

The **debug** tab is a DAP client foundation. PHP requires a separately installed compatible PHP DAP adapter and Xdebug configured in PHP; `lldb-dap`, the initial native-debugger field value, does not debug PHP. Configure the actual adapter executable/arguments and launch settings before choosing **Start debugging**. Language servers and debug adapters are not bundled, and actual PHP/LSP/DAP adapter interoperability remains unverified until tested with those installed tools. Syntax highlighting or a protocol test does not establish a working debugger.

## Current limits

- Browser preview of SinaIDE's UI cannot access the native filesystem or run these tools; use the desktop app.
- There is no automatic PHP/PostgreSQL installation, database provisioning, deployment, or credential store.
- The PHP built-in server may not reproduce Apache/Nginx rewrite rules or the PAP's production environment.
- Project search skips generated/ignored content, symlinks, binary files, and files over 2 MiB; the text editor also guards its file size.
- Language tooling and debugger coverage depend on the configured external tools. Windows and macOS validation results must be reported separately.
