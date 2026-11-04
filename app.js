import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { cognitoClientId, cognitoRegion } from './cognito-config.js';

const cognito = new CognitoIdentityProviderClient({ region: cognitoRegion });
const screens = {
  signup: document.querySelector('#signup-screen'),
  code: document.querySelector('#code-screen'),
  success: document.querySelector('#success-screen')
};
const form = document.querySelector('#signup-form');
const toast = document.querySelector('#toast');
const codeInputs = [...document.querySelectorAll('.code-row input')];
let currentEmail = sessionStorage.getItem('sidequestPendingEmail') || '';
let toastTimer;

for (let year = new Date().getFullYear() - 13; year >= 1940; year--) {
  const option = document.createElement('option');
  option.value = String(year);
  option.textContent = String(year);
  form.elements.year.append(option);
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, screen]) => {
    screen.hidden = key !== name;
    screen.classList.toggle('active', key === name);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function notice(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function setError(id, message) {
  document.querySelector(id).textContent = message;
}

function setBusy(button, busy, label) {
  button.dataset.originalLabel ||= button.textContent;
  button.disabled = busy;
  button.textContent = busy ? label : button.dataset.originalLabel;
}

function cognitoError(error) {
  const messages = {
    UsernameExistsException: '��� email 㦥 ��ॣ����஢��. �᫨ ���쬮 � ����� ��諮 ࠭��, �ᯮ���� �� ���.',
    InvalidPasswordException: '��஫� �� ���室��. ������ �� ����� 8 ᨬ�����.',
    InvalidParameterException: '�஢���� ����� ���.',
    LimitExceededException: '���誮� ����� ����ᮢ. ���஡�� �����.',
    TooManyRequestsException: '���誮� ����� ����ᮢ. ���஡�� �����.',
    CodeMismatchException: '������ ���. �஢���� ���쬮 � ���஡�� ��� ࠧ.',
    ExpiredCodeException: '�ப ����⢨� ���� ����. ������ ����.',
    NotAuthorizedException: '�� 㤠���� ���⢥न�� ����. ��������, �� 㦥 ���⢥ত�.'
  };
  return messages[error?.name] || '�� 㤠���� �易���� � �ࢨᮬ ॣ����樨. ���஡�� �����.';
}

function showCodeFor(email) {
  currentEmail = email;
  sessionStorage.setItem('sidequestPendingEmail', email);
  document.querySelector('#phone-summary').textContent = email;
  codeInputs.forEach(input => input.value = '');
  setError('#code-message', '');
  showScreen('code');
  codeInputs[0].focus();
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  setError('#signup-message', '');
  if (!form.reportValidity()) return;
  if (form.elements.password.value !== form.elements.confirmPassword.value) {
    setError('#signup-message', '��஫� �� ᮢ������.');
    form.elements.confirmPassword.focus();
    return;
  }
  const email = form.elements.contact.value.trim().toLowerCase();
  const button = form.querySelector('button[type="submit"]');
  setBusy(button, true, '��ࠢ��...');
  try {
    await cognito.send(new SignUpCommand({
      ClientId: cognitoClientId,
      Username: email,
      Password: form.elements.password.value,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'given_name', Value: form.elements.firstName.value.trim() },
        { Name: 'family_name', Value: form.elements.lastName.value.trim() },
        { Name: 'gender', Value: form.elements.gender.value },
        { Name: 'custom:birth_month', Value: form.elements.month.value },
        { Name: 'custom:birth_year', Value: form.elements.year.value }
      ]
    }));
    showCodeFor(email);
  } catch (error) {
    setError('#signup-message', cognitoError(error));
  } finally {
    setBusy(button, false);
  }
});

document.querySelectorAll('.eye').forEach(button => button.addEventListener('click', () => {
  const input = button.parentElement.querySelector('input');
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  button.setAttribute('aria-label', visible ? '������ ��஫�' : '�������� ��஫�');
}));

document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => {
  showScreen(button.dataset.back);
}));

codeInputs.forEach((input, index) => {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(-1);
    if (input.value && index < codeInputs.length - 1) codeInputs[index + 1].focus();
    setError('#code-message', '');
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Backspace' && !input.value && index > 0) codeInputs[index - 1].focus();
  });
  input.addEventListener('paste', event => {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, codeInputs.length);
    if (!digits) return;
    event.preventDefault();
    digits.split('').forEach((digit, i) => codeInputs[i].value = digit);
    codeInputs[Math.min(digits.length, codeInputs.length - 1)].focus();
  });
});

document.querySelector('#verify-code').addEventListener('click', async event => {
  const code = codeInputs.map(input => input.value).join('');
  if (code.length !== 6) {
    setError('#code-message', '������ �� 6 ���.');
    codeInputs.find(input => !input.value)?.focus();
    return;
  }
  const button = event.currentTarget;
  setBusy(button, true, '�஢�ઠ...');
  try {
    await cognito.send(new ConfirmSignUpCommand({
      ClientId: cognitoClientId,
      Username: currentEmail,
      ConfirmationCode: code
    }));
    sessionStorage.removeItem('sidequestPendingEmail');
    currentEmail = '';
    setError('#code-message', '');
    document.querySelector('#success-title').textContent = '���� ���⢥ত���';
    document.querySelector('#success-copy').textContent = '������ ᮧ���. �室 ����� ᫥���騬 蠣��.';
    showScreen('success');
  } catch (error) {
    setError('#code-message', cognitoError(error));
  } finally {
    setBusy(button, false);
  }
});

document.querySelector('#resend-code').addEventListener('click', async event => {
  if (!currentEmail) return showScreen('signup');
  const button = event.currentTarget;
  setBusy(button, true, '��ࠢ��...');
  try {
    await cognito.send(new ResendConfirmationCodeCommand({
      ClientId: cognitoClientId,
      Username: currentEmail
    }));
    codeInputs.forEach(input => input.value = '');
    setError('#code-message', '');
    notice('���� ��� ��ࠢ��� �� �����.');
    codeInputs[0].focus();
  } catch (error) {
    setError('#code-message', cognitoError(error));
  } finally {
    setBusy(button, false);
  }
});

document.querySelector('#restart').addEventListener('click', () => {
  form.reset();
  codeInputs.forEach(input => input.value = '');
  setError('#signup-message', '');
  setError('#code-message', '');
  showScreen('signup');
});

document.querySelector('#continue-confirmation').addEventListener('click', () => {
  const email = form.elements.contact.value.trim().toLowerCase();
  if (!form.elements.contact.checkValidity() || !email) {
    setError('#signup-message', '������ email, �� ����� ���� ���.');
    form.elements.contact.focus();
    return;
  }
  showCodeFor(email);
});
document.querySelector('#signin-link').addEventListener('click', () => {
  notice('�室 � ������ ����� ᫥���騬 蠣��.');
});

if (currentEmail) showCodeFor(currentEmail);


