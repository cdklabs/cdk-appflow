1. Slack uses authorization code grant for a user token
2. We can use a bot token as well, but this will have access only to a particular conversation that the bot got invited to
3. AppFlow currently cannot work with expiring access tokens
4. Actually, Slack only needs an access token.

see: https://api.slack.com/authentication/token-types and https://api.slack.com/authentication/rotation