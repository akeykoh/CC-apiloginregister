# CC-apiloginregister
API for register and login on TrashCare application.

There are provisions for input, namely:
Email: Must be a valid string and formatted email. If the email has been registered, then the user cannot register.
Password: Must be a string with a minimum length of 6 characters.
Name: Must be a string and can only contain letters of the alphabet and spaces.
Phone number: Must be a string and conform to the Indonesian telephone number format (+62 or 08). If the telephone number is already registered, then the user cannot register.
Bank name: Must be a string and can only contain letters of the alphabet and spaces.
Account name: Must be a string and can only contain letters of the alphabet and spaces.
Account number: Must be a string, only numbers, and up to 20 digits.

All data will be stored in Firestore, namely collection users with user id references.

Here is the link for our API documentation: 
https://documenter.getpostman.com/view/27909200/2s93sc4XtB
