// A Nitro plugin of the events plugin (`serverPlugins`): started with the server, like any
// Nitro plugin. This one marks the plugin's own routes in the response, so a site can tell
// in the network tab (and a test can tell) that the plugin's server code is running.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event) => {
    if ((event.path || '').startsWith('/api/cms/_p/events/')) setResponseHeader(event, 'x-cms-plugin', 'events')
  })
})
