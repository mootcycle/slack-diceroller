# Slack Dice Roller

This is a node server for moving rolling D&D/White Wolf style dice on Slack.

To set up this server, you'll need to configure your Slack team with a slash command. The slash command allows users to send a roll request from Slack to the node server and for the node server to respond. Go to https://your-team.slack.com/services and expand the section for "Slash Commands". Click the "Add" button and enter a command to active the dice roller. I recommend using "/roll". You can then configure the slash command. The URL should be "http://your-server.com/roll", the method should be "POST" and you can fill out the description and usage hint however you'd like. Make a note of the token Slack gives you, as you'll need it to configure the dice roller `teams.json` file.

On your server, you'll need to create a configuration file named `teams.json` and populate it with the webhook url and the token. The format for the `teams.json` file is:

```
[
  {
    "teamName": "your team name -- only used for decoration",
    "token": "yourLongTokenGoesHere"
  },
  { [more teams] },
]
```

Start the server with `node index.js` and test it out by issuing a /roll command on your Slack team.

You can use simple rolls like:

`/roll 3d6`

Or White Wolf rolls like this:

`/roll 4d10 diff 7`

Or more complex rolls like this:

`/roll 3d6 + 5d10 / 4 + 2d4 * 5d10 diff 8`

I don't know why you'd want to do that last one, but you could.
