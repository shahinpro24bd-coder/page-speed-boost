import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy /site/... links keep working. */
export const Route = createFileRoute("/site/$page")({
  beforeLoad: ({ params }) => {
    throw redirect({ href: `/${params.page}`, statusCode: 301 });
  },
});
