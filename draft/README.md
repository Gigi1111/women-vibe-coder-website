# Draft review copy

`/draft/` is a copy of the home page where reviewers can leave comments:
right-click any part of the page (or use **+ Add comment**), and comments appear
in the panel on the right, ordered top to bottom by where they are on the page.
People can reply, and edit or delete their own comments. Each person types their
name once; it's remembered in their browser.

Live at: https://gigi1111.github.io/women-vibe-coder-website/draft/
(hidden from search engines; share the link with reviewers).

## Files

| File | What it is |
|---|---|
| `index.html` | **Generated.** Don't edit; run `python3 draft/build.py` after changing `../index.html`. |
| `build.py` | Copies the home page into the draft and adds the comment layer. |
| `comments.js`, `comments.css` | The comment panel, pins and composer. |
| `firebase-config.js` | Your Firebase web config. While it's `null`, comments stay in your own browser ("local preview"). |
| `firestore.rules` | Security rules to paste into Firebase. |

## Connecting Firebase (one time)

1. Go to https://console.firebase.google.com and **Add project** (Google Analytics can be off).
2. **Build › Firestore Database › Create database**, production mode, a location near you.
3. In Firestore, open the **Rules** tab, replace everything with `firestore.rules`, and **Publish**.
4. **Build › Authentication › Get started › Sign-in method › Anonymous › Enable**.
5. **Project settings** (gear icon) › **Your apps** › **Web** (`</>`), register an app (no Hosting needed),
   and copy the `firebaseConfig` values into `firebase-config.js`.

## Good to know

- "Only the author can edit or delete" means *the same browser*: someone who switches
  devices or clears their browser data can't change their old comments anymore.
- To remove spam or unwanted comments, delete them in Firebase console › Firestore › `comments`.
- When the review is done, delete the `draft/` folder (and the Firebase project if you like).
