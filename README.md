## v10.5.12

- Moves **How it works** into the compact mobile header beside **Daily** and **Random**
- Uses the same button styling as those controls
- Removes the duplicate rules link from the gameplay challenge bar
- Keeps the small **Rules** link on the results page

# Geo: Second Coming — v10.5.9 Results Rules Link

This build starts directly from v10.5.7 Results First.

Results-page change:

- Adds a small **Rules** text link beside **Copy Link** on the results page
- The link opens the existing How It Works modal without restoring the full masthead or introductory panel
- Mobile styling keeps the link compact so the score remains near the top of the screen

Not changed:

- Exact self-contained challenge links from v10.5.6
- Working v10.5.5 World Bank loading path
- Round generator, solver, categories, scoring, mobile board, desktop board, or results-first layout


## v10.5.9 interaction update

Assignments can be made in either order: select a country and then a category, or select a category and then a country. Drag-and-drop remains available.


## v10.5.11
- Restores a compact **How it works** link in the phone gameplay header beside Copy link.
- Keeps the existing results-page rules link and two-way click assignment behavior.


## v10.5.13
- Copy Link now copies the exact challenge URL directly to the clipboard on phones and desktop.
- It no longer opens the native share sheet or Messages.
- Pasting into Messages should be treated as one URL/link preview rather than separate share text plus the encoded board payload.


## v11.0.4 account and leaderboard UX
- Public `/leaderboard` page with Today and All time tabs
- Header Sign in and Leaderboard controls
- Email magic-link login; Google hidden until configured
- Completed Daily preserved in local storage and automatically submitted after sign-in
- View leaderboard action beside Share score
