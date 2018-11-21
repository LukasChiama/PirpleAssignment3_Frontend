const app = {};

// Config
app.config = {
  'sessionToken': false
};

// AJAX Client (for RESTful API)
app.client = {}

// Interface for making API calls
app.client.request = function (headers, path, method, queryStringObject, payload, callback) {

  // Set defaults
  headers = typeof (headers) == 'object' && headers !== null ? headers : {};
  path = typeof (path) == 'string' ? path : '/';
  method = typeof (method) == 'string' && ['POST', 'GET', 'PUT', 'DELETE'].indexOf(method.toUpperCase()) > -1 ? method.toUpperCase() : 'GET';
  queryStringObject = typeof (queryStringObject) == 'object' && queryStringObject !== null ? queryStringObject : {};
  payload = typeof (payload) == 'object' && payload !== null ? payload : {};
  callback = typeof (callback) == 'function' ? callback : false;

  // For each query string parameter sent, add it to the path
  let requestUrl = path + '?';
  let counter = 0;
  for (const queryKey in queryStringObject) {
    if (queryStringObject.hasOwnProperty(queryKey)) {
      counter++;
      // If at least one query string parameter has already been added, preprend new ones with an ampersand
      if (counter > 1) {
        requestUrl += '&';
      }
      // Add the key and value
      requestUrl += queryKey + '=' + queryStringObject[queryKey];
    }
  }

  // Form the http request as a JSON type
  const xhr = new XMLHttpRequest();
  xhr.open(method, requestUrl, true);
  xhr.setRequestHeader("Content-type", "application/json");

  // For each header sent, add it to the request
  for (const headerKey in headers) {
    if (headers.hasOwnProperty(headerKey)) {
      xhr.setRequestHeader(headerKey, headers[headerKey]);
    }
  }

  // If there is a current session token set, add that as a header
  if (app.config.sessionToken) {
    xhr.setRequestHeader("token", app.config.sessionToken.id);
  }

  // When the request comes back, handle the response
  xhr.onreadystatechange = function () {
    if (xhr.readyState == XMLHttpRequest.DONE) {
      const statusCode = xhr.status;
      const responseReturned = xhr.responseText;

      // Callback if requested
      if (callback) {
        try {
          const parsedResponse = JSON.parse(responseReturned);
          callback(statusCode, parsedResponse);
        } catch (e) {
          callback(statusCode, false);
        }

      }
    }
  }

  // Send the payload as JSON
  const payloadString = JSON.stringify(payload);
  xhr.send(payloadString);

};

// Bind the logout button
app.bindLogoutButton = function () {
  document.getElementById("logoutButton").addEventListener("click", function (e) {

    // Stop it from redirecting anywhere
    e.preventDefault();

    // Log the user out
    app.logUserOut();

  });
};

// Log the user out then redirect them
app.logUserOut = function (redirectUser) {
  // Set redirectUser to default to true
  redirectUser = typeof (redirectUser) == 'boolean' ? redirectUser : true;

  // Get the current token id
  const tokenId = typeof (app.config.sessionToken.id) == 'string' ? app.config.sessionToken.id : false;

  // Send the current token to the tokens endpoint to delete it
  const queryStringObject = {
    'id': tokenId
  };
  app.client.request(undefined, 'api/tokens', 'DELETE', queryStringObject, undefined, function (statusCode, responsePayload) {
    // Set the app.config token as false
    app.setSessionToken(false);

    // Send the user to the logged out page
    if (redirectUser) {
      window.location = '/session/deleted';
    }

  });
};

// Bind the forms
app.bindForms = function () {
  if (document.querySelector("form")) {

    const allForms = document.querySelectorAll("form");
    for (let i = 0; i < allForms.length; i++) {
      allForms[i].addEventListener("submit", function (e) {

        // Stop it from submitting
        e.preventDefault();
        const formId = this.id;
        const path = this.action;
        const method = this.method.toUpperCase();

        // Hide the error message (if it's currently shown due to a previous error)
        document.querySelector("#" + formId + " .formError").style.display = 'none';

        // Hide the success message (if it's currently shown due to a previous error)
        if (document.querySelector("#" + formId + " .formSuccess")) {
          document.querySelector("#" + formId + " .formSuccess").style.display = 'none';
        }


        // Turn the inputs into a payload
        const payload = {};
        const elements = this.elements;
        for (let i = 0; i < elements.length; i++) {
          if (elements[i].type !== 'submit') {
            // Determine class of element and set value accordingly
            const classOfElement = typeof (elements[i].classList.value) == 'string' && elements[i].classList.value.length > 0 ? elements[i].classList.value : '';
            const valueOfElement = elements[i].type == 'orderbox' && classOfElement.indexOf('multiselect') == -1 ? elements[i].ordered : classOfElement.indexOf('intval') == -1 ? elements[i].value : parseInt(elements[i].value);
            const elementIsordered = elements[i].ordered;
            // Override the method of the form if the input's name is _method
            const nameOfElement = elements[i].name;
            if (nameOfElement == '_method') {
              method = valueOfElement;
            } else {
              // Create an payload field named "method" if the elements name is actually httpmethod
              if (nameOfElement == 'httpmethod') {
                nameOfElement = 'method';
              }
              // Create an payload field named "id" if the elements name is actually uid
              if (nameOfElement == 'uid') {
                nameOfElement = 'id';
              }
              // If the element has the class "multiselect" add its value(s) as array elements
              if (classOfElement.indexOf('multiselect') > -1) {
                if (elementIsordered) {
                  payload[nameOfElement] = typeof (payload[nameOfElement]) == 'object' && payload[nameOfElement] instanceof Array ? payload[nameOfElement] : [];
                  payload[nameOfElement].push(valueOfElement);
                }
              } else {
                payload[nameOfElement] = valueOfElement;
              }

            }
          }
        }


        // If the method is DELETE, the payload should be a queryStringObject instead
        const queryStringObject = method == 'DELETE' ? payload : {};

        // Call the API
        app.client.request(undefined, path, method, queryStringObject, payload, function (statusCode, responsePayload) {
          // Display an error on the form if needed
          if (statusCode !== 200) {

            if (statusCode == 403) {
              // log the user out
              app.logUserOut();

            } else {

              // Try to get the error from the api, or set a default error message
              const error = typeof (responsePayload.Error) == 'string' ? responsePayload.Error : 'An error has occured, please try again';

              // Set the formError field with the error text
              document.querySelector("#" + formId + " .formError").innerHTML = error;

              // Show (unhide) the form error field on the form
              document.querySelector("#" + formId + " .formError").style.display = 'block';
            }
          } else {
            // If successful, send to form response processor
            app.formResponseProcessor(formId, payload, responsePayload);
          }

        });
      });
    }
  }
};

// Form response processor
app.formResponseProcessor = function (formId, requestPayload, responsePayload) {
  const functionToCall = false;
  // If account creation was successful, try to immediately log the user in
  if (formId == 'accountCreate') {
    // Take the email and password, and use it to log the user in
    const newPayload = {
      'email': requestPayload.email,
      'password': requestPayload.password
    };

    app.client.request(undefined, 'api/tokens', 'POST', undefined, newPayload, function (newStatusCode, newResponsePayload) {
      // Display an error on the form if needed
      if (newStatusCode !== 200) {

        // Set the formError field with the error text
        document.querySelector("#" + formId + " .formError").innerHTML = 'Sorry, an error has occured. Please try again.';

        // Show (unhide) the form error field on the form
        document.querySelector("#" + formId + " .formError").style.display = 'block';

      } else {
        // If successful, set the token and redirect the user
        app.setSessionToken(newResponsePayload);
        window.location = '/orders/all';
      }
    });
  }
  // If login was successful, set the token in localstorage and redirect the user
  if (formId == 'sessionCreate') {
    app.setSessionToken(responsePayload);
    window.location = '/orders/all';
  }

  // If forms saved successfully and they have success messages, show them
  const formsWithSuccessMessages = ['accountEdit1', 'accountEdit2', 'ordersEdit1'];
  if (formsWithSuccessMessages.indexOf(formId) > -1) {
    document.querySelector("#" + formId + " .formSuccess").style.display = 'block';
  }

  // If the user just deleted their account, redirect them to the account-delete page
  if (formId == 'accountEdit3') {
    app.logUserOut(false);
    window.location = '/account/deleted';
  }

  // If the user just created a new order successfully, redirect back to the dashboard
  if (formId == 'ordersCreate') {
    window.location = '/orders/all';
  }

  // If the user just deleted a order, redirect them to the dashboard
  if (formId == 'ordersEdit2') {
    window.location = '/orders/all';
  }

};

// Get the session token from localstorage and set it in the app.config object
app.getSessionToken = function () {
  const tokenString = localStorage.getItem('token');
  if (typeof (tokenString) == 'string') {
    try {
      const token = JSON.parse(tokenString);
      app.config.sessionToken = token;
      if (typeof (token) == 'object') {
        app.setLoggedInClass(true);
      } else {
        app.setLoggedInClass(false);
      }
    } catch (e) {
      app.config.sessionToken = false;
      app.setLoggedInClass(false);
    }
  }
};

// Set (or remove) the loggedIn class from the body
app.setLoggedInClass = function (add) {
  const target = document.querySelector("body");
  if (add) {
    target.classList.add('loggedIn');
  } else {
    target.classList.remove('loggedIn');
  }
};

// Set the session token in the app.config object as well as localstorage
app.setSessionToken = function (token) {
  app.config.sessionToken = token;
  const tokenString = JSON.stringify(token);
  localStorage.setItem('token', tokenString);
  if (typeof (token) == 'object') {
    app.setLoggedInClass(true);
  } else {
    app.setLoggedInClass(false);
  }
};

// Renew the token
app.renewToken = function (callback) {
  const currentToken = typeof (app.config.sessionToken) == 'object' ? app.config.sessionToken : false;
  if (currentToken) {
    // Update the token with a new expiration
    const payload = {
      'token': currentToken.id,
      'extend': true,
    };
    app.client.request(undefined, 'api/tokens', 'PUT', undefined, payload, function (statusCode, responsePayload) {
      // Display an error on the form if needed
      if (statusCode == 200) {
        // Get the new token details
        const queryStringObject = { 'token': currentToken.id };
        app.client.request(undefined, 'api/tokens', 'GET', queryStringObject, undefined, function (statusCode, responsePayload) {
          // Display an error on the form if needed
          if (statusCode == 200) {
            app.setSessionToken(responsePayload);
            callback(false);
          } else {
            app.setSessionToken(false);
            callback(true);
          }
        });
      } else {
        app.setSessionToken(false);
        callback(true);
      }
    });
  } else {
    app.setSessionToken(false);
    callback(true);
  }
};

// Load data on the page
app.loadDataOnPage = function () {
  // Get the current page from the body class
  const bodyClasses = document.querySelector("body").classList;
  const primaryClass = typeof (bodyClasses[0]) == 'string' ? bodyClasses[0] : false;

  // Logic for account settings page
  if (primaryClass == 'accountEdit') {
    app.loadAccountEditPage();
  }

  // Logic for dashboard page
  if (primaryClass == 'ordersList') {
    app.loadOrdersListPage();
  }

  // Logic for order details page
  if (primaryClass == 'ordersEdit') {
    app.loadOrdersEditPage();
  }
};

// Load the account edit page specifically
app.loadAccountEditPage = function () {
  // Get the email number from the current token, or log the user out if none is there
  const email = typeof (app.config.sessionToken.email) == 'string' ? app.config.sessionToken.email : false;
  if (email) {
    // Fetch the user data
    const queryStringObject = {
      'email': email
    };
    app.client.request(undefined, 'api/users', 'GET', queryStringObject, undefined, function (statusCode, responsePayload) {
      if (statusCode == 200) {
        // Put the data into the forms as values where needed
        document.querySelector("#accountEdit1 .firstNameInput").value = responsePayload.firstName;
        document.querySelector("#accountEdit1 .lastNameInput").value = responsePayload.lastName;
        document.querySelector("#accountEdit1 .displayEmailInput").value = responsePayload.email;

        // Put the hidden email field into both forms
        const hiddenEmailInputs = document.querySelectorAll("input.hiddenEmailInput");
        for (let i = 0; i < hiddenEmailInputs.length; i++) {
          hiddenEmailInputs[i].value = responsePayload.email;
        }

      } else {
        // If the request comes back as something other than 200, log the user our (on the assumption that the api is temporarily down or the users token is bad)
        app.logUserOut();
      }
    });
  } else {
    app.logUserOut();
  }
};

// Load the dashboard page specifically
app.loadOrdersListPage = function () {
  // Get the email number from the current token, or log the user out if none is there
  const email = typeof (app.config.sessionToken.email) == 'string' ? app.config.sessionToken.email : false;
  if (email) {
    // Fetch the user data
    const queryStringObject = {
      'email': email
    };
    app.client.request(undefined, 'api/users', 'GET', queryStringObject, undefined, function (statusCode, responsePayload) {
      if (statusCode == 200) {

        // Determine how many orders the user has
        const allorders = typeof (responsePayload.orders) == 'object' && responsePayload.orders instanceof Array && responsePayload.orders.length > 0 ? responsePayload.orders : [];
        if (allorders.length > 0) {

          // Show each created order as a new row in the table
          allorders.forEach(function (orderId) {
            // Get the data for the order
            const newQueryStringObject = {
              'id': orderId
            };
            app.client.request(undefined, 'api/shop', 'GET', newQueryStringObject, undefined, function (statusCode, responsePayload) {
              if (statusCode == 200) {
                const orderData = responsePayload;
                // Make the order data into a table row
                const table = document.getElementById("ordersListTable");
                const tr = table.insertRow(-1);
                tr.classList.add('orderRow');
                const td0 = tr.insertCell(0);
                const td1 = tr.insertCell(1);
                const td2 = tr.insertCell(2);
                const td3 = tr.insertCell(3);
                const td4 = tr.insertCell(4);
                td0.innerHTML = responsePayload.method.toUpperCase();
                td1.innerHTML = responsePayload.protocol + '://';
                td2.innerHTML = responsePayload.url;
                const state = typeof (responsePayload.state) == 'string' ? responsePayload.state : 'unknown';
                td3.innerHTML = state;
                td4.innerHTML = '<a href="/orders/edit?id=' + responsePayload.id + '">View / Edit / Delete</a>';
              } else {
                console.log("Error trying to load order ID: ", orderId);
              }
            });
          });

          if (allorders.length < 5) {
            // Show the createorder CTA
            document.getElementById("createorderCTA").style.display = 'block';
          }

        } else {
          // Show 'you have no orders' message
          document.getElementById("noordersMessage").style.display = 'table-row';

          // Show the createorder CTA
          document.getElementById("createorderCTA").style.display = 'block';

        }
      } else {
        // If the request comes back as something other than 200, log the user our (on the assumption that the api is temporarily down or the users token is bad)
        app.logUserOut();
      }
    });
  } else {
    app.logUserOut();
  }
};


// Load the orders edit page specifically
app.loadOrdersEditPage = function () {
  // Get the order id from the query string, if none is found then redirect back to dashboard
  let id = typeof (window.location.href.split('=')[1]) == 'string' && window.location.href.split('=')[1].length > 0 ? window.location.href.split('=')[1] : false;
  if (id) {
    // Fetch the order data
    const queryStringObject = {
      'id': id
    };
    app.client.request(undefined, 'api/shop', 'GET', queryStringObject, undefined, function (statusCode, responsePayload) {
      if (statusCode == 200) {

        // Put the hidden id field into both forms
        const hiddenIdInputs = document.querySelectorAll("input.hiddenIdInput");
        for (let i = 0; i < hiddenIdInputs.length; i++) {
          hiddenIdInputs[i].value = responsePayload.id;
        }

        // Put the data into the top form as values where needed
        document.querySelector("#ordersEdit1 .displayIdInput").value = responsePayload.id;
        document.querySelector("#ordersEdit1 .displayStateInput").value = responsePayload.state;
        document.querySelector("#ordersEdit1 .protocolInput").value = responsePayload.protocol;
        document.querySelector("#ordersEdit1 .urlInput").value = responsePayload.url;
        document.querySelector("#ordersEdit1 .methodInput").value = responsePayload.method;
        document.querySelector("#ordersEdit1 .timeoutInput").value = responsePayload.timeoutSeconds;
        const successCodeorderboxes = document.querySelectorAll("#ordersEdit1 input.successCodesInput");
        for (let i = 0; i < successCodeorderboxes.length; i++) {
          if (responsePayload.successCodes.indexOf(parseInt(successCodeorderboxes[i].value)) > -1) {
            successCodeorderboxes[i].ordered = true;
          }
        }
      } else {
        // If the request comes back as something other than 200, redirect back to dashboard
        window.location = '/orders/all';
      }
    });
  } else {
    window.location = '/orders/all';
  }
};

// Loop to renew token often
app.tokenRenewalLoop = function () {
  setInterval(function () {
    app.renewToken(function (err) {
      if (!err) {
        console.log("Token renewed successfully @ " + Date.now());
      }
    });
  }, 1000 * 10);
};

// Init (bootstrapping)
app.init = function () {

  // Bind all form submissions
  app.bindForms();

  // Bind logout logout button
  app.bindLogoutButton();

  // Get the token from localstorage
  app.getSessionToken();

  // Renew token
  app.tokenRenewalLoop();

  // Load data on page
  app.loadDataOnPage();

};

// Call the init processes after the window loads
window.onload = function () {
  app.init();
};