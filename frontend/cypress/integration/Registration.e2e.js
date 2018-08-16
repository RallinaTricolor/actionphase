describe('The registration page', function () {
    it('successfully loads', function () {
        cy.visit('/home/register');
        cy.url().should('include', '/home/register');
        cy.get('[data-testid="userRegistrationForm"]').should('exist');
    });
    it('allows a user to register', function () {
        const email = Math.random().toString(36).substr(2, 5) + '@' + Math.random().toString(36).substr(2, 5) + '.com';
        const username = Math.random().toString(36).substr(2, 8);
        const password = Math.random().toString(36).substr(2, 8);
        cy.visit('/home/register');
        cy.wait(2000);
        cy.window().then((win) => {
            cy.spy(win.console, "log");
        });
        cy.get('input[name=email]').type(email);
        cy.get('input[name=username]').type(username);
        cy.get('input[name=password1]').type(`${password}`);
        cy.get('input[name=password2]').type(`${password}`);
        cy.wait(1000);
        cy.get('form').submit();
        cy.get('[data-testid="logoutButton"]', {timeout: 5000}).should('exist');
    });
});