require 'stripe'
Stripe::Customer.create(email: ENV['EMAIL'])
Stripe::Subscription::delete('sub_example')
