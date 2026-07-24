from django.db import migrations, models


def backfill_amount_paid(apps, schema_editor):
    # Every sale created before this migration was cash-only, i.e. paid in
    # full at checkout — backfill amount_paid to match so they don't show up
    # as outstanding loans.
    Sale = apps.get_model("pos", "Sale")
    Sale.objects.update(amount_paid=models.F("total_amount"))


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='sale',
            name='customer_phone',
            field=models.CharField(blank=True, default='', max_length=32),
        ),
        migrations.AddField(
            model_name='sale',
            name='amount_paid',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AlterField(
            model_name='sale',
            name='payment_method',
            field=models.CharField(
                choices=[('cash', 'Cash'), ('credit', 'Credit (loan)')],
                default='cash', max_length=20,
            ),
        ),
        migrations.RunPython(backfill_amount_paid, migrations.RunPython.noop),
    ]
