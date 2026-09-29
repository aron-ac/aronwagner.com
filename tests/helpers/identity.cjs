// Site owner details the page is expected to present. Update here when they change.
const name = 'Aron Wagner';
const email = 'aron@americancloud.com';
const companyUrl = 'https://americancloud.com/';

const socialLinks = [
  ['https://x.com/aronwagner', 'X'],
  ['https://www.linkedin.com/in/aronwagner/', 'LinkedIn'],
];

module.exports = {
  name,
  firstName: name.split(' ')[0],
  title: 'CEO, American Cloud',
  email,
  companyUrl,
  socialLinks,
  // Left monitor (X feed), then right monitor (American Cloud dashboard).
  screenLinks: [socialLinks[0], [companyUrl, 'American Cloud']],
};
