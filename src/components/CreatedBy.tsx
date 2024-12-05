import React from 'react'

export default function CreatedBy() {
  return (
    <section className="absolute bottom-0 w-full flex items-center justify-between text-xs text-muted p-4">
      <article>By Felipe Parra with ❤</article>
      <article className="text-xs text-gray-500">
        <a
          href="mailto:hola@felipeparra.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          Report a bug
        </a>
      </article>
    </section>
  )
}
