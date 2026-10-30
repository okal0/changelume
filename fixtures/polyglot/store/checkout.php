<?php
$client = new \Stripe\StripeClient(getenv('KEY'));
$transactions = $client->sources->allTransactions([]);
