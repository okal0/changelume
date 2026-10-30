require 'stripe'
Stripe::Customer.create(email: ENV['EMAIL'])
