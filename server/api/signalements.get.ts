import { createClient } from "@supabase/supabase-js";

export default defineEventHandler(async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { data, error } = await supabase
    .from("signalements")
    .select("id, type, gravite, description")
    .limit(10);

  if (error) throw createError({ statusCode: 500, message: error.message });
  return data;
});
