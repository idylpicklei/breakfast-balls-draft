-- Cloudflare Workers Web Crypto limits PBKDF2 to 100,000 iterations
UPDATE users SET password_hash = 'pbkdf2:100000:GRyu8gY4dGLXbcjozrOf7Q==:7aOFNslHjLAFDq8QzGQBuV0H1ZjTM5I5dD23PXoxcgw=' WHERE id = 'MinJungKyu';
UPDATE users SET password_hash = 'pbkdf2:100000:0wuD1XOkw81OMl8NYmc24A==:bxsHZaFpsPyvpNiwi8Qh6QFxkVXEEuv5tAISNQs4lLE=' WHERE id = 'PaulHawk';
UPDATE users SET password_hash = 'pbkdf2:100000:W7Va0DnQEXHKIpCv7gJVxQ==:3gH7iEilY/5QowowW/ddUUjVIHIQOsf0F2FHMw8+L60=' WHERE id = 'PigTank';
UPDATE users SET password_hash = 'pbkdf2:100000:rxUbp+8CAjmyfz6aKPSLLA==:n36F015QZ7riYPgJaxhzV2enV4yYv3R5sy+m53qqS+M=' WHERE id = 'Dylpickle';

DELETE FROM users WHERE id = 'admin';
