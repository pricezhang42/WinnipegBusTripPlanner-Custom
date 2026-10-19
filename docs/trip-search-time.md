# Trip search time

All search controls, native picker selections and API parameters use
`America/Winnipeg`, even when the device is elsewhere. The screen labels the
controls “Date and time · Winnipeg.” Date values remain absolute instants;
`lib/tripSearchTime.ts` is the single formatter that turns them into Winnipeg
calendar/date and 24-hour time strings. No device-local date getters or fixed UTC
offsets are used.

The existing native picker receives `timeZoneName="America/Winnipeg"` on Android
and iOS. Its returned instant is formatted in that same zone. Date selection has
the existing current-date minimum; the time picker has no instant minimum, so an
earlier clock time on a future selected day remains selectable. Dismissed picker
events do not change the selection.

## Now and manual searches

- **Now:** date/time controls and travel-mode selection are disabled. The displayed
  mode is `depart-after`. Pressing Go captures a new current instant once, updates
  the display and sends that instant in Winnipeg time, including seconds. It does
  not reuse the displayed clock's last tick or a previous arrival/before mode.
- **Manual:** the chosen date/time and travel mode are sent. The picker selects
  minutes, so seconds are `00`. Manual selections are preserved while Now is on
  and restored when it is turned off.

While Now is enabled, the visible clock updates when its minute changes and when
the app resumes. These refreshes do not run searches. Timer/listener cleanup runs
when Now is disabled or the screen unmounts.

Winnipeg's named timezone handles both daylight-saving offsets. The City's API
accepts local date/time strings without an offset; the two occurrences of 01:30
during the autumn clock change therefore serialize to the same wall-clock value.

## Verification

Automated coverage is in `lib/__tests__/tripSearchTime.test.ts` and
`components/__tests__/TripSearchTime.test.tsx`. Run under different device zones:

```sh
TZ=Asia/Tokyo npx jest tripSearchTime TripSearchTime --runInBand --watch=false
TZ=America/Los_Angeles npx jest tripSearchTime TripSearchTime --runInBand --watch=false
TZ=UTC npx jest tripSearchTime TripSearchTime --runInBand --watch=false
```

Cases cover Winnipeg midnight, 00:00 formatting, both daylight-saving changes,
manual display/request agreement, all travel modes in Now, current seconds,
arrival → Now → manual restoration, dismissed picker events and app resume.

Native checks:

1. Put an emulator in another timezone, such as Tokyo, and open Search. Confirm
   the displayed date/time still matches Winnipeg.
2. Disable Now, open both pickers and choose a future date/time. Confirm their
   values and the search controls agree; reopening/confirming without changes
   must not shift the time by the device-zone offset.
3. Choose an arrival mode, enable Now, and confirm the disabled mode shows
   `depart-after`. Disable Now again and verify the manual selection is restored.
4. Restore the emulator's original timezone settings after testing.
