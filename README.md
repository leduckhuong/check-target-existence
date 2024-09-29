Check tool: https://check-target-existence.onrender.com/


Usage: npm run cmd-tool -- --target <target> --path <pathFile>

Options:

--target <target>           The target URL to scan.

--path <pathFile>        The file containing the paths to check, one per line.

--head [headerFile]      (Optional) The file containing custom headers to include in requests.

--concurrency [concurrencyLimit] (Optional) The number of concurrent requests to send (default is 10).

--timeout [ms] (Optional) Time delay requests to send (default is 500).


Examples:

npm run cmd-tool -- --target http://example.com --path paths.txt

npm run cmd-tool -- --target http://example.com --path paths.txt --head head.txt --concurrency 10 --timeout 500
