# Dependencies Added for Users & Permissions

## New Package Installed

### bcryptjs
**Version:** Latest
**Purpose:** Password hashing for user authentication
**Usage:** Used in `routes/users.js` for secure password storage

```bash
npm install bcryptjs
```

## Why bcryptjs?

- **Security:** Industry-standard password hashing
- **Bcrypt Algorithm:** Adaptive hash function designed for passwords
- **Salt Rounds:** Configurable work factor (default: 10)
- **No Native Dependencies:** Pure JavaScript implementation
- **Cross-platform:** Works on all platforms without compilation

## Usage in Code

```javascript
const bcrypt = require('bcryptjs');

// Hash password when creating user
const password_hash = await bcrypt.hash(password, 10);

// Verify password during login
const isValid = await bcrypt.compare(password, password_hash);
```

## Security Features

- **Salting:** Automatic salt generation
- **Work Factor:** 10 rounds (2^10 iterations)
- **One-way Hash:** Cannot be reversed
- **Timing Attack Resistant:** Constant-time comparison

## Alternative: bcrypt

If you prefer the native bcrypt module:
```bash
npm uninstall bcryptjs
npm install bcrypt
```

Then update `routes/users.js`:
```javascript
const bcrypt = require('bcrypt'); // instead of bcryptjs
```

Both work identically, but bcryptjs is easier to install (no native compilation).

---

**Status:** ✅ Installed and Ready
**Required For:** User management and authentication
