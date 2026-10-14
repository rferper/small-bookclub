"""Migrate the selected container database, then replace this process with WSGI."""

import os
import subprocess
import sys

if __name__ == "__main__":
    subprocess.run([sys.executable, "manage.py", "migrate", "--noinput"], check=True)
    os.execvp(sys.argv[1], sys.argv[1:])
