# signin-ui

Simple kiosk webapp for student check-in / check-out.

## Setup

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Install Node dependencies and build static assets:

```bash
npm install
npm run build
```

## Usage

Start the application:

```bash
npm start
```

Then visit the app at <http://localhost:5000>.

## Shortcuts

Skip area selection by visiting `/area?area=<AreaName>` or `/area?=<AreaName>`.
For example, `/area?area=Reception` or `/area?=Reception`.