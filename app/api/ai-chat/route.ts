import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { answerQuestion } from "@/services/nlq/answerQuestion";

export async function POST(req: NextRequest) {
  const { question, tripId, baseCurrency } = await req.json();
  const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).single();
  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("trip_id", tripId);
  const ans = await answerQuestion(question, {
    baseCurrency: baseCurrency || trip?.base_currency || undefined,
    expenses: expenses || [],
    useGroq: true,
  });
  return Response.json(ans);
}
