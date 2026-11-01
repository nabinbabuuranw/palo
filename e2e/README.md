Live end-to-end test (Python Playwright) used for QA against the deployed site.

`python3 e2e/e2e.py OUT_DIR creds.json` where creds.json holds `{"owner":{"email","password"},"admin":{...},"customer":{...}}` for your own deployment. Credentials are never stored in this repository.
