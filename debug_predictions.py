import os
import django
import sys

# Add project root to path
sys.path.append(os.getcwd())

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from predictions.services import get_predictions

print("Running get_predictions('Gold')...")
try:
    results, error = get_predictions('Gold')
    if error:
        print(f"Error: {error}")
    else:
        print(f"Success! Got {len(results)} results.")
        if results:
            print("First result:", results[0])
            print("Last result:", results[-1])
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"Exception: {e}")
