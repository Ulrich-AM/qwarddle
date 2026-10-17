# Sake

Current art:

- `sake.png` - held gourd and thrown gourd
- `sake-droplet.png` - spit and spill droplets
- `drunken-swirls.png` - drunk-state visual and 8-slot drunk meter

Moves:

- LMB, Drink: 5 second cooldown. The hand pulls the gourd toward the mouth and tips it. Each drink fills one of 8 drunk slots and gives one equal 1/3 outcome: +25% melee damage for 5s, 25% damage reduction for 5s, or 8 health regenerated over 5s.
- Reaching 8/8 drunk slots automatically starts the drunk state and resets the meter.
- Q, Sake Spit: only available during the 5 second mouthful window after drinking. Fires a randomized fading cone of droplets, damages and knocks back, 4 second cooldown.
- Q, Sake Spill: used when there is no active mouthful. Tips the gourd, emits visible falling droplets, and leaves a #e2a417 puddle that damages and knocks an enemy into a short slip ragdoll, 5 second cooldown.
- E, Chug: 25 second cooldown. Uses the same hand-to-mouth drinking pose and immediately starts the 15 second drunk state.
- Drunk state: +50% damage, defense, movement, and jump strength, drunken swirls, and small random left/right movement. Q and E are disabled.
- Drunk LMB, Gourd Throw: 3 second cooldown. Throws toward the cursor. Fighter hits cause damage plus 3 seconds of bleed. Surface hits burst larger thick-outlined #bf7950 shards outward from the impact point.
- Shards fade over time and stop dealing damage once opacity reaches 50%.
- After a gourd throw, the held gourd fades back into the hand rather than popping in instantly.
