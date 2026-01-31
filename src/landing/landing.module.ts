import { Module } from '@nestjs/common';
import { FaqModule } from './faq/faq.module';
import { TestimonialModule } from './testimonials/testimonial.module';
import { PartnerModule } from './partners/partner.module';
import { ContactModule } from './contact/contact.module';
import { SiteConfigModule } from './site-config/site-config.module';

@Module({
  imports: [
    FaqModule,
    TestimonialModule,
    PartnerModule,
    ContactModule,
    SiteConfigModule,
  ],
  exports: [
    FaqModule,
    TestimonialModule,
    PartnerModule,
    ContactModule,
    SiteConfigModule,
  ],
})
export class LandingModule {}
