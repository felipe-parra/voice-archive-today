export default function CreatedBy() {
  return (
    <section className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 text-xs text-muted-foreground md:px-6">
      <article>Created by Felipe Parra with &hearts;</article>
      <article>
        <a
          href="mailto:hola@felipeparra.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Report a bug
        </a>
      </article>
    </section>
  )
}
