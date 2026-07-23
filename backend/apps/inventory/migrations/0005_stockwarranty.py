import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('tenants', '0001_initial'),
        ('inventory', '0004_category_brand_product_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='StockWarranty',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('warrant_id', models.CharField(blank=True, default='', max_length=64)),
                ('warranty_type', models.CharField(
                    choices=[('manufacturer', 'Manufacturer'), ('extended', 'Extended')],
                    default='manufacturer', max_length=20,
                )),
                ('duration_months', models.PositiveIntegerField(blank=True, null=True)),
                ('coverage', models.TextField(blank=True, default='')),
                ('terms', models.TextField(blank=True, default='')),
                ('is_active', models.BooleanField(default=True)),
                ('deleted_by', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='+', to=settings.AUTH_USER_MODEL,
                )),
                ('stock_unit', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE, related_name='warranties',
                    to='inventory.stockunit',
                )),
                ('tenant', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE, related_name='%(class)s_set',
                    to='tenants.tenant',
                )),
            ],
            options={
                'verbose_name_plural': 'stock warranties',
                'ordering': ['-created_at'],
            },
        ),
    ]
