#!/usr/bin/env tsx

import { promises as fs } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { Command, Options, Prompt } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { DEFAULT_TEMPLATE } from "@universal-resume/html-renderer"
import { Console, Effect, Option } from "effect"
import ora from "ora"
import puppeteer from "puppeteer"
import packageJson from "./package.json" with { type: "json" }

// --- CHOICES ---
const listResume = (await fs.readdir(path.resolve("./json"))).filter(
  (file) => path.extname(file).toLowerCase() === ".json"
)
const listTemplates = [DEFAULT_TEMPLATE]
const listColors = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "slate",
  "gray",
  "zinc",
  "stone",
]

// --- CLI OPTIONS ---
const resumeOptions = Options.choice("resume", listResume).pipe(
  Options.withAlias("r"),
  Options.withDescription("JSON resume to use"),
  Options.optional
)
const primaryColorOptions = Options.choice("primary", listColors).pipe(
  Options.withAlias("p"),
  Options.withDescription("Primary color to use"),
  Options.optional
)
const secondaryColorOptions = Options.choice("secondary", listColors).pipe(
  Options.withAlias("s"),
  Options.withDescription("Secondary color to use"),
  Options.optional
)
const templateOptions = Options.choice("template", listTemplates).pipe(
  Options.withAlias("t"),
  Options.withDescription("Template to use"),
  Options.optional
)
const outputOptions = Options.text("output").pipe(
  Options.withAlias("o"),
  Options.withDescription("Output file name of the PDF"),
  Options.optional
)
const forceOptions = Options.boolean("force").pipe(
  Options.withAlias("f"),
  Options.withDescription("Force the generation of the PDF"),
  Options.withDefault(false)
)

// --- HELPERS ---
const fileExists = (path: string, mode = fs.constants.R_OK): Effect.Effect<boolean, never, never> =>
  Effect.tryPromise(() => fs.access(path, mode).then(() => true)).pipe(
    Effect.catchAll(() => Effect.succeed(false))
  )

// --- PDF PRINTING ---
const printPDF = (
  data: object,
  template: string,
  themePrimary: string,
  themeSecondary: string,
  out: string
) =>
  Effect.gen(function* () {
    const htmlPath = path.resolve("./assets/index.html")
    const scriptPath = createRequire(import.meta.url).resolve("@universal-resume/html-renderer")

    const browser = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () =>
          puppeteer.launch({
            headless: true,
            defaultViewport: { width: 1240, height: 1754 },
            args: ["--start-maximized"],
          }),
        catch: (error) => new Error(`Failed to launch browser: ${error}`),
      }),
      (browser) =>
        Effect.ignore(
          Effect.tryPromise({
            try: () => browser.close(),
            catch: (error) => new Error(`Failed to close browser: ${error}`),
          })
        )
    )

    const pages = yield* Effect.tryPromise({
      try: () => browser.pages(),
      catch: (error) => new Error(`Failed to get pages: ${error}`),
    })

    const page = pages.shift()

    if (!page) {
      return yield* Effect.fail(new Error("Failed to get page"))
    }

    yield* Effect.tryPromise({
      try: () => page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0" }),
      catch: (error) => new Error(`Failed to load page: ${error}`),
    })
    yield* Effect.tryPromise({
      try: () => page.addScriptTag({ path: scriptPath }),
      catch: (error) => new Error(`Failed to add script tag: ${error}`),
    })
    yield* Effect.tryPromise({
      try: () =>
        page.evaluate(
          (data, template, themePrimary, themeSecondary) =>
            new Promise<void>((resolve) => {
              // biome-ignore lint/suspicious/noExplicitAny: window namespace should be valid
              ;(window as any).UniversalResume.HtmlRenderer.Renderer(data, {
                template: template as "chronology",
                theme: {
                  color: {
                    primary: themePrimary,
                    secondary: themeSecondary,
                  },
                },
                domElement: document.body,
              }).then(resolve)
            }),
          data,
          template,
          themePrimary,
          themeSecondary
        ),
      catch: (error) => new Error(`Failed to evaluate page: ${error}`),
    })

    yield* Effect.tryPromise({
      try: () =>
        page.pdf({
          path: out,
          format: "A4",
          printBackground: false,
          margin: { top: "0", bottom: "0", left: "0", right: "0" },
        }),
      catch: (error) => new Error(`Failed to generate PDF: ${error}`),
    })

    yield* Effect.tryPromise({
      try: () => browser.close(),
      catch: (error) => new Error(`Failed to close browser: ${error}`),
    })
  })

// --- SPINNER ---
const spinnerEffect = (message: string, succeed: string) =>
  Effect.sync(() => {
    const spinner = ora(message).start()

    return () => {
      spinner.succeed(succeed)
    }
  })

// --- COMMAND ---
const command = Command.make(
  "pdf-generator",
  {
    resume: resumeOptions,
    template: templateOptions,
    primaryColor: primaryColorOptions,
    secondaryColor: secondaryColorOptions,
    output: outputOptions,
    force: forceOptions,
  },
  ({ resume, template, primaryColor, secondaryColor, output, force }) => {
    return Effect.gen(function* () {
      yield* Console.log("This tool will generate a PDF from a JSON resume.")
      yield* Console.log("Please follow the prompts to configure the PDF generation.\n")

      const resolvedResumeFile = yield* (
        Option.isNone(resume)
          ? Prompt.select({
              message: "Choose a JSON resume",
              choices: listResume.map((file) => ({ title: file, value: file })),
            })
          : Effect.succeed(resume.value)
      ).pipe(Effect.map((file) => path.resolve("./json", file)))

      const resolvedPrimaryColor = Option.isNone(primaryColor)
        ? yield* Prompt.select({
            message: "Choose a primary color",
            choices: listColors.map((color) => ({ title: color, value: color })),
          })
        : primaryColor.value

      const resolvedSecondaryColor = Option.isNone(secondaryColor)
        ? yield* Prompt.select({
            message: "Choose a secondary color",
            choices: listColors.map((color) => ({ title: color, value: color })),
          })
        : secondaryColor.value

      const resolvedTemplate = Option.isNone(template)
        ? yield* Prompt.select({
            message: "Choose a template",
            choices: listTemplates.map((template) => ({ title: template, value: template })),
          })
        : template.value

      const resumeFileContent = yield* Effect.tryPromise(() =>
        fs.readFile(resolvedResumeFile, "utf-8")
      )
      const resumeData = yield* Effect.try({
        try: () => JSON.parse(resumeFileContent),
        catch: (error) => new Error(`Failed to parse JSON resume: ${error}`),
      })

      const fileName = Option.isNone(output)
        ? yield* Prompt.text({
            message: "Define the output file name",
            default: path.basename(resolvedResumeFile, path.extname(resolvedResumeFile)),
          })
        : output.value
      const outputPath = path.resolve("./out", `${fileName}.pdf`)
      const outputFileExists = yield* fileExists(outputPath)

      if (!force && outputFileExists) {
        const override = yield* Prompt.confirm({
          message: `Do you want to override ${fileName}.pdf`,
        })

        if (!override) {
          return yield* Effect.void
        }
      }

      const stopSpinner = yield* spinnerEffect(
        "Generating PDF",
        `\x1b[1mPDF generated successfully\x1b[0m at \x1b[32m${outputPath}\x1b[0m`
      )

      yield* printPDF(
        resumeData,
        resolvedTemplate,
        resolvedPrimaryColor,
        resolvedSecondaryColor,
        outputPath
      )

      yield* Effect.sync(() => stopSpinner())
    })
  }
)

const cli = Command.run(command, {
  name: "PDF generator CLI",
  version: packageJson.version,
})

cli(process.argv).pipe(Effect.provide(NodeContext.layer), Effect.scoped, NodeRuntime.runMain)
