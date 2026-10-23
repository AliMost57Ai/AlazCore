# راه‌اندازی یک‌باره با دسترسی ادمین برای اتصال دامنه به Caddy
# ۱) توقف IIS (فقط سایت پیش‌فرض placeholder — پورت ۸۰ آزاد می‌شود)
# ۲) باز کردن پورت‌های ۸۰ و ۴۴۳ در فایروال ویندوز
$log = 'D:\AliMost\NextTest\Github\AlazCore-OnlineShop\docker\elevated-setup.log'
"=== AlazCore elevated setup — $(Get-Date) ===" | Out-File $log -Encoding utf8
try {
  Stop-Service W3SVC, WAS -Force -ErrorAction Stop
  Set-Service W3SVC -StartupType Manual
  Set-Service WAS -StartupType Manual
  "IIS (W3SVC+WAS) stopped, startup=Manual" | Out-File $log -Append -Encoding utf8
} catch {
  "IIS ERROR: $_" | Out-File $log -Append -Encoding utf8
}
netsh advfirewall firewall add rule name="AlazCore HTTP 80" dir=in action=allow protocol=TCP localport=80 | Out-Null
netsh advfirewall firewall add rule name="AlazCore HTTPS 443" dir=in action=allow protocol=TCP localport=443 | Out-Null
"Firewall rules: HTTP 80 + HTTPS 443 added" | Out-File $log -Append -Encoding utf8
"DONE" | Out-File $log -Append -Encoding utf8
