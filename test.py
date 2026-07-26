import requests

res = requests.get("https://api.github.com")
print(res.status_code)