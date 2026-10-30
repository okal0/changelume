import stripe

try:
    pass
except stripe.oauth_error.UnsupportedGrantTypError:
    pass
