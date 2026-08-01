const ROLE_RANK = { viewer: 1, editor: 2, admin: 3 };

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Ikke logget ind' });
  }
  next();
}

/** Requires the user's role to be at least `minRole` (viewer < editor < admin). */
function requireRole(minRole) {
  return (req, res, next) => {
    const user = req.session.user;
    if (!user) return res.status(401).json({ error: 'Ikke logget ind' });
    if ((ROLE_RANK[user.role] || 0) < ROLE_RANK[minRole]) {
      return res.status(403).json({ error: 'Manglende rettigheder' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
