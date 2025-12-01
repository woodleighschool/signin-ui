import favicons from "favicons";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const source = "src/assets/logo.svg",
  config = {
    path: "/",
    icons: {
      favicons: true,
      appleIcon: false,
      appleStartup: false,
      android: false,
      windows: false,
      yandex: false,
    },
  };

favicons(source, config)
  .then(async (res) => {
    await mkdir("public", { recursive: true });
    const sourceSvg = await readFile(source);
    await writeFile("public/favicon.svg", sourceSvg);

    for (const image of res.images) {
      await writeFile(`public/${image.name}`, image.contents);
    }

    for (const file of res.files) {
      await writeFile(`public/${file.name}`, file.contents);
    }

    console.log("Favicons generated");
  })
  .catch(console.error);
