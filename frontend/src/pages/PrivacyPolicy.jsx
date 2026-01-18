import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-[#1B4332] hover:underline mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-[#1B4332]/10 p-8">
          <h1 className="text-3xl font-bold text-[#1B4332] mb-2">Privacy Policy</h1>
          <p className="text-[#1B4332]/60 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-green max-w-none text-[#1B4332]/80 space-y-6">

            <section>
              <h2 className="text-xl font-semibold text-[#1B4332]">1. Introduction</h2>
              <p>
                Welcome to RidersOS ("we," "our," or "us"). This Privacy Policy explains how we collect,
                use, disclose, and safeguard your information when you use our equestrian management
                platform and services (the "Service"). By using the Service, you agree to the collection
                and use of information in accordance with this policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1B4332]">2. Information We Collect</h2>
              <p>We may collect the following types of information:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Account Information:</strong> Email address, name, and profile picture when you register or sign in with Google.</li>
                <li><strong>Profile Information:</strong> Information you voluntarily provide such as roles, birthday, and guardian information.</li>
                <li><strong>Horse Information:</strong> Details about horses you register including name, breed, and health records.</li>
                <li><strong>Training Data:</strong> Session schedules, billing information, and related training activities.</li>
                <li><strong>Usage Data:</strong> Information about how you interact with the Service.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1B4332]">3. How We Use Your Information</h2>
              <p>We use the collected information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide, maintain, and improve the Service</li>
                <li>Process transactions and send related information</li>
                <li>Send notifications about sessions, billing, and other Service-related updates</li>
                <li>Respond to your comments, questions, and requests</li>
                <li>Monitor and analyze trends, usage, and activities</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1B4332]">4. Third-Party Services</h2>
              <p>
                We use Google Sign-In for authentication. When you sign in with Google, Google may
                collect information as described in their privacy policy. We only receive your basic
                profile information (name, email, profile picture) from Google.
              </p>
              <p>
                We use email services to send notifications. Your email address may be processed by
                our email service provider solely for the purpose of delivering messages.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1B4332]">5. Data Storage and Security</h2>
              <p>
                Your data is stored on secure servers. We implement appropriate technical and
                organizational measures to protect your personal information. However, no method of
                transmission over the Internet or electronic storage is 100% secure, and we cannot
                guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1B4332]">6. Data Retention</h2>
              <p>
                We retain your personal information for as long as your account is active or as needed
                to provide you services. You may request deletion of your account and associated data
                at any time by contacting us.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1B4332]">7. Children's Privacy</h2>
              <p>
                Our Service may be used by minors with parental or guardian consent. Parents or
                guardians are responsible for monitoring their children's use of the Service.
                Guardian accounts can be linked to minor accounts for oversight purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1B4332]">8. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your account and data</li>
                <li>Withdraw consent for data processing</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1B4332]">9. Disclaimer of Liability</h2>
              <p>
                <strong>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
                EITHER EXPRESS OR IMPLIED.</strong>
              </p>
              <p>
                To the fullest extent permitted by applicable law, we disclaim all warranties, express
                or implied, including but not limited to implied warranties of merchantability, fitness
                for a particular purpose, and non-infringement.
              </p>
              <p>
                <strong>We shall not be liable for any indirect, incidental, special, consequential, or
                punitive damages, including but not limited to loss of profits, data, use, or other
                intangible losses, resulting from:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your use or inability to use the Service</li>
                <li>Any unauthorized access to or use of our servers and/or any personal information stored therein</li>
                <li>Any interruption or cessation of transmission to or from the Service</li>
                <li>Any bugs, viruses, or other harmful code that may be transmitted through the Service</li>
                <li>Any errors or omissions in any content or data</li>
                <li>Any actions taken based on information provided through the Service</li>
                <li>Any horse-related activities, training sessions, or events coordinated through the Service</li>
                <li>Any financial transactions or billing disputes between users</li>
              </ul>
              <p className="font-semibold">
                YOU EXPRESSLY UNDERSTAND AND AGREE THAT YOUR USE OF THE SERVICE IS AT YOUR SOLE RISK.
                WE ARE NOT RESPONSIBLE FOR ANY PHYSICAL INJURIES, PROPERTY DAMAGE, OR ANY OTHER DAMAGES
                OR LOSSES THAT MAY RESULT FROM EQUESTRIAN ACTIVITIES COORDINATED THROUGH THIS PLATFORM.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1B4332]">10. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless RidersOS, its owners, operators,
                affiliates, and their respective officers, directors, employees, and agents from and
                against any claims, liabilities, damages, losses, costs, or expenses (including
                reasonable attorneys' fees) arising out of or in any way connected with your access
                to or use of the Service, your violation of this Privacy Policy, or your violation
                of any rights of another.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1B4332]">11. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes
                by posting the new Privacy Policy on this page and updating the "Last updated" date.
                Your continued use of the Service after any changes constitutes your acceptance of the
                new Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1B4332]">12. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us through the
                Contact page on our website.
              </p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
