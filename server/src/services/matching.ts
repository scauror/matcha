/** Compatibilité mutuelle d'orientation (bisexuel = défaut). */
export const ORIENTATION_COMPATIBLE = `
(
  (
    me.orientation = 'bisexual'
    OR (me.orientation = 'heterosexual' AND me.gender = 'female' AND u.gender = 'male')
    OR (me.orientation = 'heterosexual' AND me.gender = 'male' AND u.gender = 'female')
    OR (me.orientation = 'heterosexual' AND me.gender = 'other' AND u.gender IN ('male', 'female'))
    OR (me.orientation = 'homosexual' AND me.gender = u.gender)
  )
  AND
  (
    u.orientation = 'bisexual'
    OR (u.orientation = 'heterosexual' AND u.gender = 'female' AND me.gender = 'male')
    OR (u.orientation = 'heterosexual' AND u.gender = 'male' AND me.gender = 'female')
    OR (u.orientation = 'heterosexual' AND u.gender = 'other' AND me.gender IN ('male', 'female'))
    OR (u.orientation = 'homosexual' AND u.gender = me.gender)
  )
)
`;

export const PROFILE_READY = `
  u.email_verified = TRUE
  AND u.gender IS NOT NULL
  AND u.bio IS NOT NULL AND char_length(trim(u.bio)) > 0
  AND u.birth_date IS NOT NULL
  AND u.latitude IS NOT NULL
  AND u.longitude IS NOT NULL
  AND u.location_label IS NOT NULL
  AND EXISTS (SELECT 1 FROM photos p WHERE p.user_id = u.id AND p.is_profile = TRUE)
  AND EXISTS (SELECT 1 FROM user_tags ut WHERE ut.user_id = u.id)
`;

export const NOT_BLOCKED = `
  NOT EXISTS (
    SELECT 1 FROM blocks b
    WHERE (b.blocker_id = me.id AND b.blocked_id = u.id)
       OR (b.blocker_id = u.id AND b.blocked_id = me.id)
  )
`;

/** Distance Haversine en km, bornée pour éviter les erreurs d'arrondi acos. */
export const DISTANCE_KM = `
  6371 * acos(LEAST(1, GREATEST(-1,
    cos(radians(me.latitude)) * cos(radians(u.latitude)) *
    cos(radians(u.longitude) - radians(me.longitude)) +
    sin(radians(me.latitude)) * sin(radians(u.latitude))
  )))
`;

export const SAME_AREA_KM = 50;
