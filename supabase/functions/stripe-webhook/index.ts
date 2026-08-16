import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'
import {
  grantPro,
  grantProByEmail,
  grantProByStripeCustomer,
  revokePro,
  revokeProByStripeCustomer,
  revokeProBySubscription,
  subscriptionIsActive,
} from '../_shared/profiles.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function stripeClient(): Stripe {
  const secret = Deno.env.get('STRIPE_SECRET_KEY')
  if (!secret) throw new Error('STRIPE_SECRET_KEY is not set.')
  return new Stripe(secret, {
    apiVersion: '2024-12-18.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  })
}

function webhookSecret(): string {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set.')
  return secret
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response('Missing stripe-signature header', { status: 400 })
    }

    const body = await req.text()
    const stripe = stripeClient()
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret())
    const admin = createClient(supabaseUrl, serviceKey)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const userId = session.metadata?.supabase_user_id
        const customerId = typeof session.customer === 'string' ? session.customer : null
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : null

        if (userId) {
          await grantPro(admin, userId, {
            stripeCustomerId: customerId ?? undefined,
            stripeSubscriptionId: subscriptionId,
          })
          console.log(`Granted Pro via checkout for user ${userId}`)
        } else if (customerId) {
          await grantProByStripeCustomer(admin, customerId, subscriptionId)
          console.log(`Granted Pro via checkout for Stripe customer ${customerId}`)
        } else {
          const email = session.customer_details?.email ?? session.customer_email
          if (email) {
            const granted = await grantProByEmail(admin, email, {
              stripeCustomerId: customerId ?? undefined,
              stripeSubscriptionId: subscriptionId,
            })
            if (granted) {
              console.log(`Granted Pro via checkout email ${email}`)
            } else {
              console.warn(`checkout.session.completed: no profile for email ${email}`)
            }
          } else {
            console.warn('checkout.session.completed: missing user id, customer, and email')
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId =
          typeof subscription.customer === 'string' ? subscription.customer : null
        const subscriptionId = subscription.id
        const userId = subscription.metadata?.supabase_user_id

        if (subscriptionIsActive(subscription.status)) {
          if (userId) {
            await grantPro(admin, userId, {
              stripeCustomerId: customerId ?? undefined,
              stripeSubscriptionId: subscriptionId,
            })
          } else if (customerId) {
            await grantProByStripeCustomer(admin, customerId, subscriptionId)
          }
        } else if (userId) {
          await revokePro(admin, userId)
        } else if (customerId) {
          await revokeProByStripeCustomer(admin, customerId)
        } else {
          await revokeProBySubscription(admin, subscriptionId)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId =
          typeof subscription.customer === 'string' ? subscription.customer : null
        if (customerId) {
          await revokeProByStripeCustomer(admin, customerId)
        } else {
          await revokeProBySubscription(admin, subscription.id)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId =
          typeof invoice.subscription === 'string' ? invoice.subscription : null
        if (subscriptionId) {
          await revokeProBySubscription(admin, subscriptionId)
        }
        break
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('stripe-webhook error:', e)
    return new Response(String(e), { status: 400 })
  }
})
