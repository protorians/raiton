

export function swaggerHtmlPagePlugin() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>API Docs</title>
      <link rel="stylesheet" href="/assets/mods/@stoplight/elements/styles.min.css">
      <style>
      html, body {
        margin: 0;
        padding: 0;
        height: 100%;
      }
</style>
    </head>
    <body>
      <elements-api
        apiDescriptionUrl="/docs/json"
        router="hash"
        layout="sidebar"
      />
      <script src="/assets/mods/@stoplight/elements/web-components.min.js"></script>
    </body>
    </html>
  `
}