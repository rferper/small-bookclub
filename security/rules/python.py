import os
import subprocess
import requests
import yaml

# ruleid: python-dynamic-execution
eval("fictional")
# ruleid: python-dynamic-execution
exec("fictional")
# ruleid: python-shell-execution
os.system("fictional")
# ruleid: python-shell-execution
subprocess.run("fictional", shell=True)
# ruleid: python-disabled-tls
requests.get("https://example.invalid", verify=False)
# ruleid: python-unsafe-yaml
yaml.unsafe_load("fictional")
# ok: python-shell-execution
subprocess.run(["fictional"], shell=False)
# ok: python-disabled-tls
requests.get("https://example.invalid", verify=True)
# ok: python-unsafe-yaml
yaml.safe_load("fictional")
