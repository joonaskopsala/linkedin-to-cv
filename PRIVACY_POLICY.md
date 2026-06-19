# Privacy Policy — LinkedIn to CV Builder

**Last updated: June 2026**

## Overview

LinkedIn to CV Builder is a browser extension that converts your LinkedIn PDF export into a formatted, printable CV. This policy explains what data is handled and how.

## Data We Collect

**We collect no data.** The extension does not transmit, store, or log any personal information to any server.

## How the Extension Works

- You provide a LinkedIn PDF file from your own device.
- The PDF is parsed **entirely within your browser** using the bundled PDF.js library.
- The generated CV is rendered and downloaded locally to your device.
- If you use the optional LinkedIn profile photo feature, the extension briefly opens a LinkedIn tab in your browser to read your profile photo. This tab is closed automatically. No data from this process is sent anywhere.

## Permissions

| Permission                       | Reason                                                                   |
| -------------------------------- | ------------------------------------------------------------------------ |
| `activeTab`                      | Required to interact with the current browser tab                        |
| `scripting`                      | Required to inject the photo extraction script into a LinkedIn tab       |
| `downloads`                      | Required to save the generated PDF to your device                        |
| `tabs`                           | Required to open and close a temporary LinkedIn tab for photo extraction |
| `host_permissions: linkedin.com` | Required for the optional profile photo feature                          |

## Third-Party Services

This extension does not contact any third-party services or APIs.

## Changes

If this policy changes, the updated version will be published in the extension's GitHub repository.

## Contact

For questions, open an issue at the extension's GitHub repository.
