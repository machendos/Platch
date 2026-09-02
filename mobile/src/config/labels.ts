/* What a project with no name is called wherever one is shown.

   The column is nullable, so this is not a fallback for data that failed to
   arrive — it is how an unset name renders, and it renders the same way in
   every list, row and crumb because it comes from here.

   The editable name field is the one place it must not appear: there an unset
   name is an empty field showing its placeholder, and pre-filling it with this
   would be text the user has to delete before typing their own. */
export const UNNAMED_PROJECT = '(no name)';

export const projectName = (name: string | null | undefined): string =>
  name?.trim() ? name : UNNAMED_PROJECT;
