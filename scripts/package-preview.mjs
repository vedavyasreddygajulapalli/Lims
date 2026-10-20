import { readFile, writeFile, readdir } from "node:fs/promises";
const directory = new URL("../web/preview-dist/", import.meta.url);
let html = await readFile(new URL("index.html", directory), "utf8");
for (const file of await readdir(new URL("assets/", directory))) {
  const text = await readFile(new URL("assets/" + file, directory), "utf8");
  if (file.endsWith(".js"))
    html = html.replace(
      /<script[^>]+src="[^"]+"[^>]*><\/script>/,
      () =>
        '<script type="module">' +
        text.replaceAll("</script", "<\\/script") +
        "</script>",
    );
  if (file.endsWith(".css"))
    html = html.replace(
      /<link[^>]+href="[^"]+\.css"[^>]*>/,
      () => "<style>" + text + "</style>",
    );
}
html = html.replace("<title>", "<title>Demo · ");
await writeFile(
  new URL("../Sri_Sainath_LIMS_Preview.html", import.meta.url),
  html,
);
console.log("Standalone preview created.");
