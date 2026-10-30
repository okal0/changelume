import stripe
def handle():
    try:
        raise RuntimeError('controlled')
    except stripe.oauth_error.UnsupportedGrantTypError:
        return 'declined'
