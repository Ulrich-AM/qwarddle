# Qward character sprites

Character art uses six files, arranged as three base/outline + recolorable layer pairs.

## Body

- `qward-body.png` - fixed outline/base pixels
- `qward-body-color.png` - recolorable body region

## Hand

- `qward-hand.png` - fixed outline/base pixels
- `qward-hand-color.png` - recolorable hand region

## Foot

- `qward-foot.png` - fixed outline/base pixels
- `qward-foot-color.png` - recolorable foot region

The recolorable layers use `#ff0000` as the editable color region. Keep the rest of each `-color` image transparent so QWARDDLE can tint it without runtime pixel readback.

Customization mapping:

- CHEST -> body color layer
- ARMS -> generated arm segments + hand color layer
- LEGS -> generated leg segments + both foot color layers

The procedural arm and leg segments remain generated without extra outlines.

If any sprite is missing, the old placeholder geometry remains as a fallback.
