import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL!.replace('/rest/v1/', '');
const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const eventId = '4c9ded14-3659-458b-8593-ac4fe5346e43';
  const characters = 1647;
  const unitCost = 0.000016;
  const totalCost = characters * unitCost;

  console.log(`Updating event ${eventId} with:`);
  console.log(`- model_name: 'pt-BR-Journey-F'`);
  console.log(`- unit_cost_at_time: ${unitCost}`);
  console.log(`- total_cost_usd: ${totalCost}`);
  console.log(`- status: 'success'`);

  const { data, error } = await supabaseAdmin
    .from('api_usage_events')
    .update({
      model_name: 'pt-BR-Journey-F',
      unit_cost_at_time: unitCost,
      total_cost_usd: totalCost,
      status: 'success',
      error_message: null
    })
    .eq('id', eventId)
    .select();

  if (error) {
    console.error('❌ Failed to update telemetry event:', error.message);
  } else {
    console.log('✅ Successfully updated telemetry event! Data:', data);
  }
}
run();
