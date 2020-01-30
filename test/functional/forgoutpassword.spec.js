const {test, trait, beforeEach, afterEach} = use('Test/Suite')('Forgot Password');

const {subHours, format} = require('date-fns');

const Mail = use('Mail');
const Hash = use('Hash');
const Database = use('Database');

/** @type {import('@adonisjs/lucid/src/Factory')} */
const Factory = use('Factory');

/**@type {typeof import('@adonisjs/lucid/src/Lucid/Model)}*/
const User = use('App/Models/User');

trait('Test/ApiClient');
trait('DatabaseTransactions');

test('it should send email with forgot password instructions', async ({assert, client}) => {
  Mail.fake();

  const email = 'guga@teste.com';
  const user = await Factory
    .model('App/Models/User')
    .create({email});

  await client
    .post('/forgot')
    .send({email})
    .end();

  const token = await user.tokens().first();

  const recentMail = Mail.pullRecent();

  assert.equal(recentMail.message.to[0].address, email);

  assert.include(token.toJSON(), {
    user_id: user.id,
    type: 'forgotpassword'
  });

  Mail.restore();
});

test('it should be able to reset password ', async ({assert, client}) => {
  const email = 'guga@teste.com';

  const user = await Factory.model('App/Models/User').create({email});
  const userToken = await Factory.model('App/Models/Token').make();

  await user.tokens().save(userToken);

  await client.post('/reset')
    .send({
      token: userToken.token,
      password: '321123',
      password_confirmation: '321123'
    })
    .end();

  await user.reload();

  const checkPassword = await Hash.verify('321123', user.password);

  assert.isTrue(checkPassword);
});

test('it cannot reset password after 2h of forgot password requested', async ({client, asset}) => {
  const email = 'guga@teste.com';

  const user = await Factory.model('App/Models/User').create({email});
  const userToken = await Factory.model('App/Models/Token').make();

  await user.tokens().save(userToken);

  const dateSub = format(subHours(new Date(), 5), 'yyyy-MM-dd HH:ii:ss');

  await Database
    .table('tokens')
    .where('token', userToken.token)
    .update('created_at', dateSub);

  await userToken.reload();

  const response = await client.post('/reset')
    .send({
      token: userToken.token,
      password: '321123',
      password_confirmation: '321123'
    })
    .end();

  response.assertStatus(400)
});
