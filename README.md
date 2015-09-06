# Slack Dice Roller

This is a node server for moving rolling D&D/White Wolf style dice on Slack.

To set up this server, you'll need to first configure your Slack team with a slash command and an incoming webhook. The slash command allows users to send a roll request from Slack to the node server and the incoming webhook allows the node server to respond to Slack with the roll result. Start by going to https://your-team.slack.com/services and looking for the "Incoming WebHooks" integration. If it is not in the list of configured integrations, you can add it from the "All Services" tab. Expand the "Incoming WebHooks" section and click the "Add" button. Slack will ask you to choose a channel for the webhook to post to. You can choose any channel, as the Dice Roller will override that setting when it is invoked. Click the "Add Incoming Webhooks Integration" button. On the next page, you can fill in the configuration fields if you want to, but make a note of the "Webhook URL" as you'll need it to configure the dice roller.

Next, go back to https://your-team.slack.com/services and expand the section for "Slash Commands". Click the "Add" button and enter a command to active the dice roller. I recommend using "/roll". You can then configure the slash command. The URL should be "http://your-server.com/roll", the method should be "POST" and you can fill out the description and usage hint however you'd like. Make a note of the token Slack gives you, as you'll need it to configure the dice roller.

On your server, you'll need to create a configuration file named `teams.json` and populate it with the webhook url and the token. The format for the `teams.json` file is:

```[
  {
    "teamName": "your team name",
    "teamId": "TXXXXXXXX",
    "webHookUrl": "https://hooks.slack.com/yourwebhook",
    "token": "yourLongTokenGoesHere"
  },
  { [more teams] },
]```

Start the server with `node index.js` and test it out by issuing a /roll command on your Slack team.

You can use simple rolls like:

`/roll 3d6`

Or White Wolf rolls like this:

`/roll 4d10 diff 7`

Or more complex rolls like this:

`/roll 3d6 + 5d10 / 4 + 2d4 * 5d10 diff 8`

I don't know why you'd want to do that last one, but you could.
